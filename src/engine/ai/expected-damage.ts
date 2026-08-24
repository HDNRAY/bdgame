import type { Character } from '../entities/character'
import type { ActionDefinition } from '../entities/action'
import type { BattleState, BuffLayer } from '../combat/types'
import type { BattleEngine } from '../combat/engine'
import type { BuffDef } from '../../data/buffs/types'
import { getActionRange, getRuntimeAction } from '../../data/actions'
import { getWeapon } from '../../data/weapons/weapons'
import {
    calcBaseDamage,
    calcCritChance,
    calcHitChance,
    calcParryChance,
    calcParriedDamage,
    calcPoisonTicksPerStack,
} from '../calc/damage'
import { DMG_PER_POISON_TICK } from '../constants'
import { cloneBuffsFor, forEachBuffOf } from '../combat/utils'

export interface DamageEstimate {
    actionId: string
    rawDamage: number
    expectedDamage: number
    hitChance: number
    canReach: boolean
    apCost: number
    chanCost: number
}

/**
 * 模拟 DOT tick 的 onDebuffTick 钩子链（对齐 tick-engine 真实路径）。
 * 遍历目标身上所有带 onDebuffTick 的 buff，链式修正单跳伤害（泼油×2 / 铸火×0.5 / 千锤百炼×0.7 等自动生效）。
 */
function applyDotTickHooks(
    pendings: Map<string, BuffLayer>,
    target: Character,
    buffId: 'burn' | 'poison' | 'bleed',
    damage: number,
): number {
    let final = damage
    forEachBuffOf(pendings, target.id, (def, layer) => {
        if (!def?.onDebuffTick) return
        const result = def.onDebuffTick({ buffId, target, damage: final, layer })
        if (result !== undefined) final = result
    })
    return final
}

/**
 * 模拟施加 debuff 时攻击者的 onDebuffApplied 钩子（对齐 handlers.ts 真实路径）。
 * 遍历攻击者身上所有带 onDebuffApplied 的 buff，作用于克隆 layer——层数/倍率修正（铸火+层、七心海棠毒翻倍）自动生效；
 * 副作用型钩子（十香软筋散/西域奇毒挂 debuff）因无 engine 直接跳过，不会污染真实状态。
 */
function applyDebuffAppliedHooks(
    pendings: Map<string, BuffLayer>,
    attacker: Character,
    defender: Character,
    buffId: 'burn' | 'poison',
    stacks: number,
    state: BattleState,
): BuffLayer {
    // 克隆 layer 供钩子修正（真实路径传入的是刚施加/叠加的 burn/poison 层数据）
    const layer: BuffLayer = { restoreValue: stacks, extra: {} }
    forEachBuffOf(pendings, attacker.id, (def) => {
        if (!def?.onDebuffApplied) return
        def.onDebuffApplied({ self: attacker, enemy: defender, buffId, stacks, layer, state })
    })
    return layer
}

/** 计算招式对目标的期望伤害（含全部 buff 钩子） */
export function calcExpectedDamage(
    action: ActionDefinition,
    attacker: Character,
    defender: Character,
    weaponRange: [number, number],
    state: BattleState,
    atDistance?: number,
): DamageEstimate {
    // 克隆可变参数（钩子篡改只影响克隆，不影响原件）
    const safeAtk = Object.create(attacker) as Character
    const safeDef = Object.create(defender) as Character
    // 只克隆两个角色的 layer（钩子只读写它们）+ 轻量浅克隆，替代 structuredClone 全量深拷贝（热路径 ~44% 开销）
    const safePendings = cloneBuffsFor(state.pendingBuffs, [safeAtk.id, safeDef.id])
    const safeState = { ...state, pendingBuffs: safePendings }

    // atDistance 提供时用指定距离评估（planner 在 target 落点评估段2 招式，避免用当前距离失真）
    const distance = atDistance !== undefined ? atDistance : state.position.distance(safeAtk.id, safeDef.id)
    // getRuntimeAction 需访问真实 Character 的 actions（safeAtk 是 Object.create 原型 clone 无法访问私有字段），
    // 传原始 attacker 只读取；state 用 clone 的 safeState 保证不污染真实 buff
    const actionRange = getActionRange(getRuntimeAction(action.id, attacker, safeState) ?? action, weaponRange, safeAtk)
    const canReach = distance >= actionRange[0] && distance <= actionRange[1]

    // 1. 基础伤害
    let rawDamage = 0
    for (const eff of action.effects ?? []) {
        if (eff.type === 'damage' && 'scaling' in eff)
            rawDamage +=
                (calcBaseDamage(eff.scaling, safeAtk.attrs.getAll(), eff.base ?? 0) + (eff.piercing ?? 0)) *
                (eff.independentHits ?? 1)
        if (eff.type === 'fixed_damage') rawDamage += (eff.value ?? 0) * (eff.independentHits ?? 1)
        if (eff.type === 'missing_hp_damage') rawDamage += Math.round((safeDef.maxHp - safeDef.hp) * eff.ratio)
        if (eff.type === 'self_missing_hp_damage') rawDamage += Math.round((safeAtk.maxHp - safeAtk.hp) * eff.ratio)
        if (eff.type === 'self_hp_cost') {
            // 血引：先按当前气血比例扣（miss 也耗）。扣血后后续 functional_damage 基于扣血后 hp 算（与真实路径一致）；
            // 自耗血量记为负贡献（≈对手白赚了等量血量优势），让 AI 认识到血滴子这类「血换伤」招式的代价
            const cost = Math.round(safeAtk.hp * eff.ratio)
            if (cost > 0) {
                safeAtk.hp = Math.max(0, safeAtk.hp - cost)
                rawDamage -= cost
            }
        }
        if (eff.type === 'functional_damage') {
            rawDamage += eff.fn({
                self: safeAtk,
                enemy: safeDef,
                state: { ...state, pendingBuffs: new Map(state.pendingBuffs) },
                emitLog: () => {},
            })
        }
        if (eff.type === 'add_debuff') {
            // DoT 期望按真实伤害模型估 × 命中后独立施加减益的概率（此前统一 stacks×3 低估灼烧/中毒，且漏乘 chance 高估低概率毒）
            if (eff.buffId === 'burn') {
                // 命中期望层数（chance 独立 roll 后实际叠加的层数）
                const hitStacks = Math.round(eff.stacks * (eff.chance ?? 1))
                // 攻击者 onDebuffApplied（铸火诀 WIS≥15 +2 否则 +1 等）作用于克隆层
                const appliedLayer = applyDebuffAppliedHooks(
                    safePendings,
                    safeAtk,
                    safeDef,
                    'burn',
                    hitStacks,
                    safeState,
                )
                const n = appliedLayer.restoreValue
                // 真实衰减灼烧：N 层逐跳 2N, 2(N-1), …, 2，每跳过目标 onDebuffTick 钩子（泼油×2/铸火×0.5 等自动生效）
                for (let k = n; k >= 1; k--) {
                    rawDamage += applyDotTickHooks(safePendings, safeDef, 'burn', 2 * k)
                }
            } else if (eff.buffId === 'poison') {
                const stacks = eff.stacks * (eff.chance ?? 1)
                // 七心海棠等 onDebuffApplied 设 poisonMult=2（作用于克隆 layer，不改真实）
                const appliedLayer = applyDebuffAppliedHooks(
                    safePendings,
                    safeAtk,
                    safeDef,
                    'poison',
                    stacks,
                    safeState,
                )
                const mult = (appliedLayer.extra?.poisonMult as number | undefined) ?? 1
                const ticks = calcPoisonTicksPerStack(safeDef.attrs.get('wisdom'))
                for (let i = 0; i < ticks; i++) {
                    rawDamage += applyDotTickHooks(safePendings, safeDef, 'poison', stacks * DMG_PER_POISON_TICK * mult)
                }
            } else if (eff.buffId === 'bleed') {
                // 流血按 ~2 次触发估，每跳走 onDebuffTick 钩子
                rawDamage += applyDotTickHooks(safePendings, safeDef, 'bleed', eff.stacks * 3 * (eff.chance ?? 1))
            }
        }
    }

    // 2. 收集 buff 修正值（直接累到克隆上）。招架可能性/暴击钩子也在此单循环收集，
    //    避免每个 calcExpectedDamage 调用多轮全量扫描（热路径）
    let hitMod = 0
    let critChanceMod = 0
    let critDamageMod = 0
    let critTakenChanceMod = 0
    let critTakenDamageMod = 0
    let cannotBeParried = false
    let buffCanParry: boolean | undefined
    const critHooks: { def: BuffDef; layer: BuffLayer }[] = []
    forEachBuffOf(safePendings, [safeAtk.id, safeDef.id], (def, layer, _b, _k, ownerId) => {
        if (!def) return
        const ctx = { final: 0, raw: 0, target: safeDef, attacker: safeAtk, state: safeState, layer, source: action }
        // onAction 必须在其他钩子之前调用（如抽刀断水需要先算 diff）
        if (ownerId === safeAtk.id && def.onAction) def.onAction(ctx)
        if (ownerId === safeDef.id && def.onDodgeChance) safeDef.dodgeMod += def.onDodgeChance(ctx)
        if (ownerId === safeAtk.id && def.onHitChance) hitMod += def.onHitChance(ctx)
        if (ownerId === safeDef.id && def.onParryChance) safeDef.parryMod += def.onParryChance(ctx)
        if (ownerId === safeAtk.id && def.onCritChance) critChanceMod += def.onCritChance(ctx)
        if (ownerId === safeAtk.id && def.onCritDamage) critDamageMod += def.onCritDamage(ctx)
        // 防御方降被暴击率/被爆伤（逆转经脉、百纳珠等）
        if (ownerId === safeDef.id && def.onCritTakenChance) critTakenChanceMod += def.onCritTakenChance(ctx)
        if (ownerId === safeDef.id && def.onCritTakenDamage) critTakenDamageMod += def.onCritTakenDamage(ctx)
        // 招架可能性（引擎 resolveParry）：onCanBeParried=false → 不可被招架；onCanParry 任一 false → 不可招架
        if (ownerId === safeAtk.id && def.onCanBeParried) {
            // 钩子只读 self/source；engine 无实例，占位（真实钩子不访问）
            if (!def.onCanBeParried({ self: safeAtk, source: action, engine: undefined as unknown as BattleEngine })) {
                cannotBeParried = true
            }
        }
        if (ownerId === safeDef.id && def.onCanParry) {
            // 引擎语义：任一 onCanParry 返回 false → 不可招架（false 永久锁定，不再被后续 true 覆盖）
            if (def.onCanParry({ self: safeDef, engine: undefined as unknown as BattleEngine })) {
                if (buffCanParry !== false) buffCanParry = true
            } else {
                buffCanParry = false
            }
        }
        // onAfterCritDamage 钩子收集（暴击分支用，按 priority 排序后应用）
        if (ownerId === safeAtk.id && def.onAfterCritDamage) {
            critHooks.push({ def, layer })
        }
    })
    // 招式自带爆伤加成（返回最终爆伤修正，覆盖而非累加）
    if (action.onActionCritDamage) critDamageMod = action.onActionCritDamage(critDamageMod, state, attacker)

    // 3. 命中率
    const baseHc = calcHitChance({
        attackerDexterity: safeAtk.attrs.get('dexterity'),
        attackerInsight: safeAtk.attrs.get('insight'),
        defenderAgility: safeDef.attrs.get('agility'),
        defenderInsight: safeDef.attrs.get('insight'),
        defenderDodgeMod: safeDef.dodgeMod,
    })
    const hitChance = (action.onActionHitChance?.(baseHc, state, attacker) ?? baseHc) + hitMod

    // 4. 招架 + 暴击（引擎 resolveParry：不可被招架或目标无法招架 → 招架率归零）
    // cannotBeParried / buffCanParry 已在上面 mod 单循环收集
    const hasIgnoreParry = (action.effects ?? []).some((e) => e.type === 'ignore_parry')
    const defWeapon = safeDef.weaponDef ?? getWeapon(safeDef.build.weapon)
    const hasParryTag = defWeapon.tags.includes('parry')
    const canParry = buffCanParry ?? hasParryTag
    const parryChance =
        hasIgnoreParry || cannotBeParried || !canParry
            ? 0
            : calcParryChance(safeDef.attrs.get('dexterity'), safeDef.attrs.get('insight')) + safeDef.parryMod
    // 防御方降被暴击率修正暴击率（引擎 resolveCrit 中 onCritTakenChance 同向累加）
    const rawCrit = calcCritChance(
        safeAtk.attrs.get('dexterity'),
        safeAtk.attrs.get('insight'),
        critChanceMod + critTakenChanceMod,
    )
    const critChance = action.onActionCritChance?.(rawCrit, state, attacker) ?? rawCrit

    // 5. 期望伤害：只算攻击方的期望输出 = 命中概率 × 命中条件下的伤害（招架混合 → 暴击 → 穿透）。
    //    防御方减伤（onTakeDamage：铁布衫/石肤/金钟罩/炁盾等）不参与——闪避/招架是攻防交互概率（算），
    //    防御数值是战斗细节（不算），否则"打不动"会让 AI 放弃攻击（护盾永不破 = 死锁）。
    //    攻击方自身增伤（onDealDamage：狼狩/血祭/空手道等）作用于裸伤（算，属于攻击力）。
    let buffed = rawDamage
    let buffPiercing = 0
    forEachBuffOf(safePendings, [safeDef.id, safeAtk.id], (def, layer, _b, _k, ownerId) => {
        if (!def) return
        if (ownerId === safeAtk.id && def.onDealDamage) {
            const result = def.onDealDamage({
                final: buffed,
                raw: rawDamage,
                target: safeDef,
                attacker: safeAtk,
                state: safeState,
                layer,
                source: action,
            })
            if (typeof result === 'object') {
                buffed = result.normal
                buffPiercing += result.piercing ?? 0
            } else {
                buffed = result
            }
        }
    })

    // 招架段：先按裸招架减伤算，再叠加防御方 onParryReduction 与攻击方 onParryPenetration（引擎同序）
    let parriedDamage = calcParriedDamage(buffed, safeDef.attrs.get('strength'))
    forEachBuffOf(safePendings, safeDef.id, (def, layer) => {
        if (!def?.onParryReduction) return
        parriedDamage = def.onParryReduction({
            final: parriedDamage,
            raw: buffed,
            target: safeDef,
            attacker: safeAtk,
            state: safeState,
            layer,
            source: action,
        })
    })
    forEachBuffOf(safePendings, safeAtk.id, (def, layer) => {
        if (!def?.onParryPenetration) return
        parriedDamage = def.onParryPenetration({
            final: parriedDamage,
            raw: buffed,
            target: safeDef,
            attacker: safeAtk,
            state: safeState,
            layer,
            source: action,
        })
    })
    parriedDamage = Math.round(parriedDamage * 10) / 10
    // 命中条件下的普通分支（招架混合）
    const normalBranch = (1 - parryChance) * buffed + parryChance * parriedDamage
    // 暴击分支：普通分支 × 爆伤（0.5 + 攻击方爆伤 - 防御方降被爆伤），再走攻击方 onAfterCritDamage 链
    // （引擎 applyDamage：暴击时按 priority 升序链式覆盖——如意劲耗3缠加爆伤、血棘·压制爆伤转流血）
    let critBranch = normalBranch * (1 + 0.5 + critDamageMod + critTakenDamageMod)
    critHooks.sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0))
    for (const { def, layer } of critHooks) {
        critBranch = def.onAfterCritDamage!({
            damage: normalBranch,
            critDamage: critBranch,
            final: critBranch,
            raw: rawDamage,
            target: safeDef,
            attacker: safeAtk,
            state: safeState,
            layer,
            source: action,
        })
    }
    let condFinal = (1 - critChance) * normalBranch + critChance * critBranch
    // 穿透伤害无视招架/暴击最后加
    condFinal += buffPiercing

    // 6. piercingRatio（引擎按暴击后伤害计算）
    for (const eff of action.effects ?? []) {
        if (eff.type === 'damage' && eff.piercingRatio) {
            condFinal += Math.round(condFinal * eff.piercingRatio)
        }
    }

    // 命中率只决定能否造成伤害（引擎 calcRoll：p>1 必中、p<0 必失 → clamp [0,1]）
    const expected = Math.min(1, Math.max(0, hitChance)) * condFinal

    return {
        actionId: action.id,
        rawDamage,
        expectedDamage: expected,
        hitChance,
        canReach,
        apCost: attacker.actionApCost(action.apCost),
        chanCost: action.chanCost ?? 0,
    }
}

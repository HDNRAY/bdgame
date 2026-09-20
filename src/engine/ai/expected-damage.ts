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
import { forEachBuffOf, forEachHookOf } from '../combat/utils'
import { calcActionChanCost } from '../combat/utils/action-cost'
import { rng } from '../util/rng'
import { buffPresence, hookMaskOf } from '../combat/utils/buff-registry'
import type { HookPresence, RegisteredHook } from '../combat/utils/buff-registry'
import { calcChokeTickDamage } from '../../data/buffs/debuffs'

/**
 * 本函数会读取到的全部 buff 钩子白名单（用于受限沙盒克隆 cloneForHooks）。
 *
 * 只有 def 命中本白名单（拥有其中任一钩子）的层才会被克隆进 safeState；因此
 * 「在 calcExpectedDamage 里新读取了某个 def.onXxx」时必须同步加到这里，否则该层会被沙盒漏掉、期望伤害失真。
 * 除下方直接出现的 def.onXxx，还包含间接读取：
 *  - onRuntimeAction：getRuntimeAction(action.id, attacker, safeState) 内部按攻击方 buff 修正运行时招式
 *  - onDebuffTick / onDebuffApplied：DoT 期望与施毒钩子链（见 applyDotTickHooks / applyDebuffAppliedHooks）
 *  - onActionCost：estimateApCost 累加 AP 折扣（空手道/漫天花雨/明镜止水/分心错手…），
 *    漏掉它会让这些层不进沙盒、`DamageEstimate.apCost` 恒为折前值
 *  - onHaste：actionApCost → getHaste(safeState) → calcExtraHaste 读的急速（风切/身法护持…），
 *    漏掉它沙盒算出的身法减免与真源不一致
 *  - onActionChanCost：calcActionChanCost 累加缠劲折扣（明镜止水…），漏掉它 AI 会按原价估缠劲
 */
export const EVAL_HOOKS: readonly RegisteredHook[] = [
    'onAction',
    'onActionCost',
    'onActionChanCost',
    'onAfterCritDamage',
    'onCanBeParried',
    'onCanParry',
    'onCritChance',
    'onCritDamage',
    'onCritTakenChance',
    'onCritTakenDamage',
    'onDealDamage',
    'onDebuffApplied',
    'onDebuffTick',
    'onDodgeChance',
    'onHaste',
    'onHitChance',
    'onParryChance',
    'onParryPenetration',
    'onParryReduction',
    'onPostCritDamage',
    'onRuntimeAction',
    'onTakeDamage',
]

/**
 * 第 2 段「双方层单循环收集修正值」会读取的全部钩子。这些钩子一个都不存在时，整个循环可跳过。
 * （循环内的钩子调用顺序敏感——onAction 必须先于同层其他钩子、且按层顺序交错，故只能整段守卫，不能拆成多个子循环。）
 */
const COLLECT_LOOP_HOOKS: readonly RegisteredHook[] = [
    'onAction',
    'onDodgeChance',
    'onHitChance',
    'onParryChance',
    'onCritChance',
    'onCritDamage',
    'onCritTakenChance',
    'onCritTakenDamage',
    'onCanBeParried',
    'onCanParry',
    'onAfterCritDamage',
]

/** COLLECT_LOOP_HOOKS 的预计算掩码（热路径判空零分配） */
const COLLECT_LOOP_MASK = hookMaskOf(COLLECT_LOOP_HOOKS)

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
    present: HookPresence,
    target: Character,
    buffId: 'burn' | 'poison' | 'bleed',
    damage: number,
): number {
    // 目标身上一个 onDebuffTick 层都没有（多数对局如此）→ 整段扫描跳过。
    // present 按「双方层」查询，是目标层的超集：只可能少跳过，不可能误跳过。
    if (!present.has('onDebuffTick')) return damage
    let final = damage
    forEachHookOf(pendings, 'onDebuffTick', target.id, (def, layer) => {
        const result = def.onDebuffTick?.({ buffId, target, damage: final, layer })
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
    present: HookPresence,
    attacker: Character,
    defender: Character,
    buffId: 'burn' | 'poison',
    stacks: number,
    state: BattleState,
    action?: ActionDefinition,
): BuffLayer {
    // 克隆 layer 供钩子修正（真实路径传入的是刚施加/叠加的 burn/poison 层数据）
    const layer: BuffLayer = { restoreValue: stacks, extra: {} }
    // 攻击方一个 onDebuffApplied 层都没有 → 没有钩子能改写 layer，直接返回初值
    if (!present.has('onDebuffApplied')) return layer
    forEachHookOf(pendings, 'onDebuffApplied', attacker.id, (def) => {
        def.onDebuffApplied?.({ self: attacker, enemy: defender, buffId, stacks, layer, state, source: action })
    })
    return layer
}

/** 计算招式对目标的期望伤害（含全部 buff 钩子） */
/**
 * 推演沙盒的固定种子。
 *
 * 每次评估都从同一颗种子开始 → 同一个候选每次估值完全一致（可复现、无噪声），
 * 而且**主战斗的随机流一个数都不会被动到**（否则 AI 试算会吃掉真实战斗的骰子，
 * 沙盒一改就移动平衡）。
 */
const SIM_SEED = 0x5eed5eed


/** 期望伤害评估：外层只负责进出推演沙盒，逻辑在 Inner 里（保证所有 return 路径都会退出沙盒） */
export function calcExpectedDamage(
    action: ActionDefinition,
    attacker: Character,
    defender: Character,
    weaponRange: [number, number],
    state: BattleState,
    atDistance?: number,
    opts?: { applyDefenseReduction?: boolean },
): DamageEstimate {
    rng.enterSandbox(SIM_SEED)
    try {
        return calcExpectedDamageInner(action, attacker, defender, weaponRange, state, atDistance, opts)
    } finally {
        rng.exitSandbox()
    }
}

/**
 * 招式是否含「不透明效果」——`functional_damage` / `functional_heal` 的 fn 是任意代码，
 * 不受钩子白名单约束（可直读任意层、也可遍历某角色全部层），故这类招式必须用全量克隆评估。
 */
function hasOpaqueFn(action: ActionDefinition): boolean {
    return (action.effects ?? []).some((e) => e.type === 'functional_damage' || e.type === 'functional_heal')
}

function calcExpectedDamageInner(
    action: ActionDefinition,
    attacker: Character,
    defender: Character,
    weaponRange: [number, number],
    state: BattleState,
    atDistance?: number,
    opts?: { applyDefenseReduction?: boolean },
): DamageEstimate {
    // 克隆可变参数（钩子篡改只影响克隆，不影响原件）；资源流水必须自带一份，见 Character.forkForSim
    const safeAtk = attacker.forkForSim()
    const safeDef = defender.forkForSim()
    // 沙盒 state：只克隆**评估路径会读到的**层（EVAL_HOOKS 命中的那些），比全量克隆快一截。
    //
    // 以前它被搁置，是因为"少克隆几层"会改变沙盒消耗随机数的次数 → 主战斗的随机数流分叉；
    // 现在沙盒自带随机数流（`rng.enterSandbox`，见本函数上下的 enter/exit），主战斗不再受影响，
    // 而且 `expected-damage-clone-parity.test.ts` 钉住了「受限克隆 ≡ 全量克隆」的逐位一致性。
    //
    // 例外：含 `functional_*` 效果的招式不能走受限克隆。
    //
    // fn 是任意代码，可以按 key 直读任意层（毒素引爆读 `poison::<目标>` 的 remainingTicks）、
    // 或遍历某角色的**全部**层（推演数自身非永久层数）。按「def 有没有白名单钩子」筛层时，
    // 这些层可能因为一个「结算遍历类」钩子都没有而被整体漏掉（中毒层只有 onDebuffApply，
    // 那是施加时的单点回调、不进 hooks 桶），于是期望伤害静默算成 0 —— AI 永远不出这张牌。
    // 这类招式退回全量克隆（只影响含 fn 的少数招式，代价可忽略）。
    //
    // state 恒为 BattleState class（生产与 DevMode 评估均构造真 class）
    const safeState = hasOpaqueFn(action)
        ? state.cloneFor([safeAtk.id, safeDef.id])
        : state.cloneForHooks([safeAtk.id, safeDef.id], EVAL_HOOKS)

    // 钩子存在性视图：下面每处「遍历双方层找某钩子」前先判空——一个层都不带该钩子就整段跳过扫描。
    // 视图与 forEachBuffOf 同源（按 byOwner + def 的注册钩子），按 registry 结构 revision 缓存；
    // 同一 revision 内查询为位运算 O(1)，层增删后自动重算。语义等价，只是不扫空桶。
    const present = buffPresence(safeState.pendingBuffs, [safeAtk.id, safeDef.id])

    // atDistance 提供时用指定距离评估（planner 在 target 落点评估段2 招式，避免用当前距离失真）
    const distance = atDistance !== undefined ? atDistance : state.position.distance(safeAtk.id, safeDef.id)
    // getRuntimeAction 需访问真实 Character 的 actions（safeAtk 是 Object.create 原型 clone 无法访问私有字段），
    // 传原始 attacker 只读取；state 用 clone 的 safeState 保证不污染真实 buff
    const actionRange = getActionRange(getRuntimeAction(action.id, attacker, safeState) ?? action, weaponRange, safeAtk)
    const canReach = distance >= actionRange[0] && distance <= actionRange[1]

    // 1. 基础伤害
    let rawDamage = 0
    for (const eff of action.effects ?? []) {
        if (eff.type === 'damage') {
            const dmg = (eff.scaling ? calcBaseDamage(eff.scaling, safeAtk.attrs.getAll(), 0) : 0) + (eff.fixed ?? 0)
            rawDamage += (dmg + (eff.piercing ?? 0)) * (eff.independentHits ?? 1)
        }
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
                // safeState 已是隔离沙盒（cloneFor 或 fallback 拷贝），fn 只读不写真源
                state: safeState,
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
                    safeState.pendingBuffs,
                    present,
                    safeAtk,
                    safeDef,
                    'burn',
                    hitStacks,
                    safeState,
                    action,
                )
                const n = appliedLayer.restoreValue
                // 真实衰减灼烧：N 层逐跳 2N, 2(N-1), …, 2，每跳过目标 onDebuffTick 钩子（泼油×2/铸火×0.5 等自动生效）
                for (let k = n; k >= 1; k--) {
                    rawDamage += applyDotTickHooks(safeState.pendingBuffs, present, safeDef, 'burn', 2 * k)
                }
            } else if (eff.buffId === 'poison') {
                const stacks = eff.stacks * (eff.chance ?? 1)
                // 七心海棠等 onDebuffApplied 设 poisonMult=2（作用于克隆 layer，不改真实）
                const appliedLayer = applyDebuffAppliedHooks(
                    safeState.pendingBuffs,
                    present,
                    safeAtk,
                    safeDef,
                    'poison',
                    stacks,
                    safeState,
                )
                const mult = (appliedLayer.extra?.poisonMult as number | undefined) ?? 1
                const ticks = calcPoisonTicksPerStack(safeDef.attrs.get('wisdom'))
                for (let i = 0; i < ticks; i++) {
                    rawDamage += applyDotTickHooks(
                        safeState.pendingBuffs,
                        present,
                        safeDef,
                        'poison',
                        stacks * DMG_PER_POISON_TICK * mult,
                    )
                }
            } else if (eff.buffId === 'bleed') {
                // 流血按 ~2 次触发估，每跳走 onDebuffTick 钩子
                rawDamage += applyDotTickHooks(
                    safeState.pendingBuffs,
                    present,
                    safeDef,
                    'bleed',
                    eff.stacks * 3 * (eff.chance ?? 1),
                )
            } else if (eff.buffId === 'choke') {
                // 窒息（裸绞）：tick_buff 通道每秒绞杀，不走 onDebuffTick 链（不吃泼油/毒体等修正）。
                // 每跳伤害直接调 buff 自身共享公式 calcChokeTickDamage（与引擎 tick 同一份代码）；
                // duration 3s/tick 1s → 第三跳与 buff_end 同刻且 buff_end 先执行，满 duration 稳定 2 跳；
                // 施加方每跳 -1 AP、力道可挣脱只会更短，故按满 duration 估 2 跳（与真实 log 窒息段 2 跳一致）。
                const perTick = calcChokeTickDamage(safeAtk)
                rawDamage += perTick * 2 * (eff.chance ?? 1)
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
    let dodgeMod = 0
    let parryMod = 0
    const critHooks: { def: BuffDef; layer: BuffLayer }[] = []
    if (present.hasAny(COLLECT_LOOP_MASK)) {
        forEachBuffOf(safeState.pendingBuffs, [safeAtk.id, safeDef.id], (def, layer, _b, _k, ownerId) => {
            if (!def) return
            const ctx = { final: 0, raw: 0, target: safeDef, attacker: safeAtk, state: safeState, layer, source: action }
            // onAction 必须在其他钩子之前调用（如抽刀断水需要先算 diff）
            if (ownerId === safeAtk.id && def.onAction) def.onAction(ctx)
            if (ownerId === safeDef.id && def.onDodgeChance) dodgeMod += def.onDodgeChance(ctx)
            if (ownerId === safeAtk.id && def.onHitChance) hitMod += def.onHitChance(ctx)
            if (ownerId === safeDef.id && def.onParryChance) parryMod += def.onParryChance(ctx)
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
    }
    // 招式自带爆伤加成（返回最终爆伤修正，覆盖而非累加）
    if (action.onActionCritDamage) critDamageMod = action.onActionCritDamage(critDamageMod, state, attacker)

    // 3. 命中率
    const baseHc = calcHitChance({
        attackerDexterity: safeAtk.attrs.get('dexterity'),
        attackerInsight: safeAtk.attrs.get('insight'),
        defenderAgility: safeDef.attrs.get('agility'),
        defenderInsight: safeDef.attrs.get('insight'),
        defenderDodgeMod: dodgeMod,
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
            : calcParryChance(safeDef.attrs.get('dexterity'), safeDef.attrs.get('insight')) + parryMod
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
    if (present.has('onDealDamage')) {
        forEachHookOf(safeState.pendingBuffs, 'onDealDamage', safeAtk.id, (def, layer) => {
            const result = def.onDealDamage?.({
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
            } else if (typeof result === 'number') {
                buffed = result
            }
        })
    }

    // 招架段：先按裸招架减伤算，再叠加防御方 onParryReduction 与攻击方 onParryPenetration（引擎同序）。
    // 引擎顺序：暴击+爆伤 → onAfterCritDamage → 穿透拆出 → 招架（只作用于 non-pierce 部分）。
    // 穿透部分无视招架，故招架混合只对 normal 分支（非暴击）与 critNormal 分支（暴击的 non-pierce 部分）做。
    // 穿透比例 = 招式 piercingRatio + 攻击方 onPostCritDamage 拆出比例，加算上限 100%（总伤害不膨胀，穿透是结算方式）。
    // onParryPenetration 返回穿掉的伤害值，多个加法聚合，clamp 到最多把招架段减免(blocked)穿干净。
    // 注：eval 按用户口径不算防御方减伤/吸收（onTakeDamage/onAbsorb），招架概率仍算。
    const parriedOf = (x: number): number => {
        let pd = calcParriedDamage(x, safeDef.attrs.get('strength'))
        if (present.has('onParryReduction')) {
            forEachHookOf(safeState.pendingBuffs, 'onParryReduction', safeDef.id, (def, layer) => {
                const reduced = def.onParryReduction?.({
                    final: pd,
                    raw: x,
                    target: safeDef,
                    attacker: safeAtk,
                    state: safeState,
                    layer,
                    source: action,
                })
                if (reduced !== undefined) pd = reduced
            })
        }
        // 攻击方穿透：收集穿掉的伤害值，加法聚合后 clamp 到 blocked
        const blocked = x - pd
        if (blocked > 0) {
            let piercedTotal = 0
            if (present.has('onParryPenetration')) {
                forEachHookOf(safeState.pendingBuffs, 'onParryPenetration', safeAtk.id, (def, layer) => {
                    const pierced = def.onParryPenetration?.({
                        final: pd,
                        raw: x,
                        target: safeDef,
                        attacker: safeAtk,
                        state: safeState,
                        layer,
                        source: action,
                    })
                    if (pierced && pierced > 0) piercedTotal += pierced
                })
            }
            pd = Math.round((pd + Math.min(piercedTotal, blocked)) * 10) / 10
        }
        return Math.round(pd * 10) / 10
    }
    const mixParry = (x: number): number => (1 - parryChance) * x + parryChance * parriedOf(x)

    // 招式自带百分比穿透比例（如三寸光 50%）
    let actionPierceRatio = 0
    for (const eff of action.effects ?? []) {
        if (eff.type === 'damage' && eff.piercingRatio) {
            actionPierceRatio += eff.piercingRatio
        }
    }
    /** 对某分支伤害做穿透拆分：返回 { normal, pierce }，穿透比例加算、上限 100% */
    const splitPierce = (base: number): { normal: number; pierce: number } => {
        let pierceRatio = actionPierceRatio
        if (present.has('onPostCritDamage')) {
            forEachHookOf(safeState.pendingBuffs, 'onPostCritDamage', safeAtk.id, (def, layer) => {
                const r = def.onPostCritDamage?.({
                    final: base,
                    raw: rawDamage,
                    target: safeDef,
                    attacker: safeAtk,
                    state: safeState,
                    layer,
                    source: action,
                })
                if (typeof r === 'object') {
                    const total = r.normal + (r.piercing ?? 0)
                    if (total > 0) pierceRatio += (r.piercing ?? 0) / total
                } else if (typeof r === 'number') {
                    base = r
                }
            })
        }
        pierceRatio = Math.min(1, pierceRatio)
        return { normal: Math.round(base * (1 - pierceRatio) * 10) / 10, pierce: Math.round(base * pierceRatio * 10) / 10 }
    }

    // 普通分支（非暴击）：裸伤 → 穿透拆分（穿透部分无视招架）
    const np = splitPierce(buffed)
    const normalBranch = mixParry(np.normal) + np.pierce

    // 暴击分支：基于裸伤 × 爆伤（引擎 resolveCrit 传入裸伤，不再乘招架混合后的普通分支），
    // 再走攻击方 onAfterCritDamage 链，最后穿透拆分
    // （引擎 applyDamage：暴击时按 priority 升序链式覆盖——如意劲耗3缠加爆伤、血棘·压制爆伤转流血）
    let critFinal = buffed * (1 + 0.5 + critDamageMod + critTakenDamageMod)
    critHooks.sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0))
    for (const { def, layer } of critHooks) {
        critFinal = def.onAfterCritDamage!({
            damage: buffed,
            critDamage: critFinal,
            final: critFinal,
            raw: rawDamage,
            target: safeDef,
            attacker: safeAtk,
            state: safeState,
            layer,
            source: action,
        })
    }
    const cp = splitPierce(critFinal)
    const critBranch = mixParry(cp.normal) + cp.pierce
    let condFinal = (1 - critChance) * normalBranch + critChance * critBranch
    // 增伤阶段 buff 拆出的穿透（onDealDamage 返回对象）无视招架/暴击最后加
    condFinal += buffPiercing

    // 命中率只决定能否造成伤害（引擎 calcRoll：p>1 必中、p<0 必失 → clamp [0,1]）
    let expected = Math.min(1, Math.max(0, hitChance)) * condFinal

    // 可选：应用防御方减伤链（compare 等 DevMode 工具想算"真实可打出伤害"时开启；
    // AI 决策默认不开——避免对手肉导致 AI 放弃攻击/护盾永不破死锁，见函数头注释）。
    // 命中期望上遍历防御方 onTakeDamage（铁布衫/石肤 ×0.85/×0.9 等），招架混合已在 condFinal 内。
    // 近似：穿透部分引擎免减伤，此处按全量打折（compare 精度可接受）。
    if (opts?.applyDefenseReduction && present.has('onTakeDamage')) {
        forEachHookOf(safeState.pendingBuffs, 'onTakeDamage', safeDef.id, (def, layer) => {
            const taken = def.onTakeDamage?.({
                final: expected,
                raw: rawDamage,
                target: safeDef,
                attacker: safeAtk,
                state: safeState,
                layer,
                source: action,
            })
            if (taken !== undefined) expected = taken
        })
    }

    return {
        actionId: action.id,
        rawDamage,
        expectedDamage: expected,
        hitChance,
        canReach,
        apCost: estimateApCost(action, safeAtk, safeDef, safeState),
        chanCost: calcActionChanCost(safeState, safeAtk, action, safeDef),
    }
}

/**
 * 本招的 AP 成本：`baseApCost + Σ onActionCost`（每个 buff 各自 clamp 最低 1）→ 过身法/急速减免。
 *
 * 与引擎真实扣费同口径（`engine.ts` 的 `#executeAction`、`action-executor.canExecuteAction`、
 * `planner.actionCostAt` 都是 `max(1, cost + hook())` 再 `actionApCost`）。此前这里只做
 * `actionApCost(action.apCost)`，于是 `DamageEstimate.apCost` 比实扣高一截（桑原·空手道实测：
 * 手刀 1.7 vs 实扣 1.5、回旋踢 4.3 vs 4.1），而 planner 拿它当 `baseApCost` 做效率排序 ——
 * 所有被 onActionCost 折扣的招式（空手道/漫天花雨/明镜止水/独臂/以力驭剑/分心错手）在 AI 眼里系统性偏贵。
 *
 * 钩子在**沙盒** layer 上跑：分心错手这类有状态钩子（写 `layer.extra.firstActionDone`）不会污染真源，
 * 而它读到的正是"本回合是否已出过主招"的真实状态。
 */
function estimateApCost(
    action: ActionDefinition,
    safeAtk: Character,
    safeDef: Character,
    safeState: BattleState,
): number {
    // 0 成本招式（御物召唤等）天然免费：引擎跳过整段 AP 计算，不校验也不打折
    if (action.apCost <= 0) return action.apCost
    let cost = action.apCost
    forEachHookOf(safeState.pendingBuffs, 'onActionCost', safeAtk.id, (def, layer) => {
        const delta = def.onActionCost?.({
            final: 0,
            raw: 0,
            attacker: safeAtk,
            target: safeDef,
    state: safeState,
    layer,
    source: action,
})
        if (delta) cost = Math.max(1, cost + delta)
    })
    return safeAtk.actionApCost(cost, safeState)
}

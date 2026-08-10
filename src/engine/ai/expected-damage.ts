import type { Character } from '../entities/character'
import type { ActionDefinition } from '../entities/action'
import type { BattleState } from '../combat/types'
import { getActionRange } from '../../data/actions'
import { calcBaseDamage, calcCritChance, calcHitChance, calcParryChance, calcParriedDamage } from '../calc/damage'
import { forEachBuffOf } from '../combat/utils'

export interface DamageEstimate {
    actionId: string
    rawDamage: number
    expectedDamage: number
    hitChance: number
    canReach: boolean
    apCost: number
    chanCost: number
}

/** 计算招式对目标的期望伤害（含全部 buff 钩子） */
export function calcExpectedDamage(
    action: ActionDefinition,
    attacker: Character,
    defender: Character,
    weaponRange: [number, number],
    state: BattleState,
): DamageEstimate {
    // 克隆可变参数（钩子篡改只影响克隆，不影响原件）
    const safeAtk = Object.create(attacker) as Character
    const safeDef = Object.create(defender) as Character
    const safePendings = new Map([...state.pendingBuffs].map(([k, v]) => [k, structuredClone(v)]))
    const safeState = { ...state, pendingBuffs: safePendings }

    const distance = state.position.distance(safeAtk.id, safeDef.id)
    const actionRange = getActionRange(action, weaponRange, safeAtk)
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
        if (eff.type === 'functional_damage') {
            rawDamage += eff.fn({
                self: safeAtk,
                enemy: safeDef,
                state: { ...state, pendingBuffs: new Map(state.pendingBuffs) },
                emitLog: () => {},
            })
        }
        if (eff.type === 'add_debuff' && ['burn', 'poison', 'bleed'].includes(eff.buffId)) rawDamage += eff.stacks * 3
    }

    // 2. 收集 buff 修正值（直接累到克隆上）
    let hitMod = 0
    let critChanceMod = 0
    let critDamageMod = 0
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

    // 4. 招架 + 暴击（带 ignore_parry 效果的招式无视招架 → 招架率归零）
    const hasIgnoreParry = (action.effects ?? []).some((e) => e.type === 'ignore_parry')
    const parryChance = hasIgnoreParry
        ? 0
        : calcParryChance(safeDef.attrs.get('dexterity'), safeDef.attrs.get('insight')) + safeDef.parryMod
    const rawCrit = calcCritChance(safeAtk.attrs.get('dexterity'), safeAtk.attrs.get('insight'), critChanceMod)
    const critChance = action.onActionCritChance?.(rawCrit, state, attacker) ?? rawCrit

    // 5. 期望伤害
    let expected =
        hitChance *
        ((1 - parryChance) * rawDamage + parryChance * calcParriedDamage(rawDamage, safeDef.attrs.get('strength')))
    expected *= 1 + critChance * (0.5 + critDamageMod)

    // 6. onDealDamage 修正
    forEachBuffOf(safePendings, safeAtk.id, (def, layer) => {
        if (!def?.onDealDamage) return
        const result = def.onDealDamage({
            final: expected,
            raw: rawDamage,
            target: safeDef,
            attacker: safeAtk,
            state: safeState,
            layer,
            source: action,
        })
        expected = typeof result === 'object' ? result.normal + (result.piercing ?? 0) : result
    })

    // 7. piercingRatio
    for (const eff of action.effects ?? []) {
        if (eff.type === 'damage' && eff.piercingRatio) {
            expected += Math.round(expected * eff.piercingRatio)
        }
    }

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

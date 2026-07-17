import type { Character } from '../entities/character'
import type { ActionDefinition } from '../entities/action'
import type { BattleState } from '../combat/types'
import { getActionRange } from '../entities/action'
import { calcBaseDamage, calcCritChance, calcHitChance, calcParryChance, calcParriedDamage } from '../calc/damage'
import { getBuff } from '../../data/buffs'

export interface DamageEstimate {
    actionId: string
    rawDamage: number
    expectedDamage: number
    hitChance: number
    canReach: boolean
    apCost: number
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
            })
        }
        if (eff.type === 'add_debuff' && ['burn', 'poison', 'bleed'].includes(eff.buffId)) rawDamage += eff.stacks * 3
    }

    // 2. 收集 buff 修正值（直接累到克隆上）
    let hitMod = 0
    for (const [key, layer] of safePendings) {
        const p = key.split('::')
        if (p.length < 2) continue
        const def = getBuff(p[0])
        if (!def) continue
        const ctx = { final: 0, raw: 0, target: safeDef, attacker: safeAtk, state: safeState, layer, source: action }
        // onAction 必须在其他钩子之前调用（如抽刀断水需要先算 diff）
        if (p[1] === safeAtk.id && def.onAction) def.onAction(ctx)
        if (p[1] === safeDef.id && def.onDodgeChance) safeDef.dodgeMod += def.onDodgeChance(ctx)
        if (p[1] === safeAtk.id && def.onHitChance) hitMod += def.onHitChance(ctx)
        if (p[1] === safeDef.id && def.onParryChance) safeDef.parryMod += def.onParryChance(ctx)
        if (p[1] === safeAtk.id && def.onCritChance) safeAtk.critChance += def.onCritChance(ctx)
        if (p[1] === safeAtk.id && def.onCritDamage) safeAtk.critDamageMod += def.onCritDamage(ctx)
    }

    // 3. 命中率
    const baseHc = calcHitChance({
        attackerDexterity: safeAtk.attrs.get('dexterity'),
        attackerInsight: safeAtk.attrs.get('insight'),
        defenderAgility: safeDef.attrs.get('agility'),
        defenderInsight: safeDef.attrs.get('insight'),
        defenderDodgeMod: safeDef.dodgeMod,
    })
    const hitChance = (action.onActionHitChance?.(baseHc, state, attacker) ?? baseHc) + hitMod

    // 4. 招架 + 暴击
    const parryChance =
        calcParryChance(0, safeDef.attrs.get('dexterity'), safeDef.attrs.get('insight')) + safeDef.parryMod
    const rawCrit = calcCritChance(safeAtk.attrs.get('dexterity'), safeAtk.attrs.get('insight'), safeAtk.critChance)
    const critChance = action.onActionCritChance?.(rawCrit) ?? rawCrit

    // 5. 期望伤害
    let expected =
        hitChance *
        ((1 - parryChance) * rawDamage + parryChance * calcParriedDamage(rawDamage, safeDef.attrs.get('strength')))
    expected *= 1 + critChance * (0.5 + safeAtk.critDamageMod)

    // 6. onDealDamage 修正
    for (const [key, layer] of safePendings) {
        const p = key.split('::')
        if (p.length < 2 || p[1] !== safeAtk.id) continue
        const def = getBuff(p[0])
        if (!def?.onDealDamage) continue
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
    }

    // 7. piercingRatio
    for (const eff of action.effects ?? []) {
        if (eff.type === 'damage' && eff.piercingRatio) {
            expected += Math.round(expected * eff.piercingRatio)
        }
    }

    return { actionId: action.id, rawDamage, expectedDamage: expected, hitChance, canReach, apCost: action.apCost }
}

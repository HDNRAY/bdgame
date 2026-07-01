import type { Character } from '../entities/character'
import type { ActionDefinition, EffectDef } from '../entities/action'
import type { BattleState } from '../combat/types'
import { getActionRange } from '../entities/action'
import { calcBaseDamage, calcCritChance, calcHitChance, calcParryChance } from '../calc/damage'

export interface DamageEstimate {
    actionId: string
    rawDamage: number
    expectedDamage: number
    hitChance: number
    canReach: boolean
    apCost: number
}

/** 计算招式对目标的期望伤害（含命中/暴击/招架/闪避） */
export function calcExpectedDamage(
    action: ActionDefinition,
    attacker: Character,
    defender: Character,
    weaponRange: [number, number],
    state: BattleState,
): DamageEstimate {
    const distance = state.position.distance(attacker.id, defender.id)

    // 1. 可达性：getRange > range > weaponRange
    const actionRange = getActionRange(action, weaponRange, attacker)
    const canReach = distance >= actionRange[0] && distance <= actionRange[1]

    // 2. 基础伤害（遍历所有伤害效果，含 missing_hp_damage）
    let rawDamage = 0
    for (const eff of action.effects ?? []) {
        if (eff.type === 'damage' && 'scaling' in eff) {
            rawDamage += calcBaseDamage(
                (eff as Extract<NonNullable<ActionDefinition['effects']>[number], { type: 'damage' }>).scaling,
                attacker.attrs.getAll(),
                (eff as Extract<NonNullable<ActionDefinition['effects']>[number], { type: 'damage' }>).base ?? 0,
            )
        }
        if (eff.type === 'fixed_damage') {
            rawDamage += eff.value ?? 0
        }
        if (eff.type === 'missing_hp_damage') {
            rawDamage += Math.round(
                (defender.maxHp - defender.hp) * (eff as Extract<EffectDef, { type: 'missing_hp_damage' }>).ratio,
            )
        }
        if (eff.type === 'self_missing_hp_damage') {
            rawDamage += Math.round(
                (attacker.maxHp - attacker.hp) * (eff as Extract<EffectDef, { type: 'self_missing_hp_damage' }>).ratio,
            )
        }
        if (eff.type === 'functional_damage') {
            // 克隆 pendingBuffs，防止 fn 篡改真实战斗状态
            const clonedState = { ...state, pendingBuffs: new Map(state.pendingBuffs) }
            rawDamage += eff.fn({ self: attacker, enemy: defender, state: clonedState })
        }
        // debuff 持续伤害估值（灼烧/中毒/流血 ≈ 每层3点）
        if (eff.type === 'add_debuff') {
            const dotBuffs = ['burn', 'poison', 'bleed']
            if (dotBuffs.includes(eff.buffId)) {
                rawDamage += eff.stacks * 3
            }
        }
    }

    // 3. 命中率
    const baseHc = calcHitChance({
        attackerDexterity: attacker.attrs.get('dexterity'),
        attackerInsight: attacker.attrs.get('insight'),
        defenderAgility: defender.attrs.get('agility'),
        defenderInsight: defender.attrs.get('insight'),
        defenderDodgeMod: defender.dodgeMod,
    })
    const hitChance = Math.min(0.95, action.onActionHitChance?.(baseHc) ?? baseHc)

    // 4. 招架概率 + 暴击概率
    const parryChance = Math.min(
        0.9,
        calcParryChance(0, defender.attrs.get('dexterity'), defender.attrs.get('insight')) + defender.parryMod,
    )
    const critChance = calcCritChance(
        attacker.attrs.get('dexterity'),
        attacker.attrs.get('insight'),
        attacker.critChance,
    )

    // 5. 期望伤害
    const parryMultiplier = 1 - parryChance * 0.5 // 招架后约减免 50%
    const critMultiplier = 1 + critChance * (0.5 + attacker.critDamageMod) // 暴击额外 + (1.5 + critDmgMod - 1)
    const expectedDamage = rawDamage * hitChance * parryMultiplier * critMultiplier

    return { actionId: action.id, rawDamage, expectedDamage, hitChance, canReach, apCost: action.apCost }
}

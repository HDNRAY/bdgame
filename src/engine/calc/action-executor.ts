import type { ActionDefinition } from '../entities/action'
import type { Character } from '../entities/character'
import { calcBaseDamage, calcDistanceMultiplier, calcCrippleBonus, calcSelfDamage, WEAPONS } from './damage'

export interface ResolvedDamage {
    base: number
    distanceMult: number
    isCrit: boolean
    final: number
    isFixedDamage: boolean
}

/** 解析招式的基础伤害（damage / fixed_damage） */
export function resolveAction(action: ActionDefinition, attacker: Character, currentDistance: number): ResolvedDamage {
    let base = 0
    let isFixedDamage = false

    for (const effect of action.effects ?? []) {
        if (effect.type === 'damage') {
            base += calcBaseDamage(effect.scaling, attacker.attrs.getAll())
        } else if (effect.type === 'fixed_damage') {
            base = effect.value
            isFixedDamage = true
        }
    }

    const distanceMult = isFixedDamage ? 1 : calcDistanceMultiplier(currentDistance, action.bestDistance)
    return {
        base,
        distanceMult,
        isCrit: false,
        final: 0, // filled later with crit
        isFixedDamage,
    }
}

/** 从招式 effects 中提取非伤害效果数据 */
export function extractActionEffects(
    action: ActionDefinition,
    attacker: Character,
    defender: Character,
): { crippleBonus: number; selfDamage: number; knockbackDistance: number } {
    let crippleBonus = 0
    let selfDamage = 0
    let knockbackDistance = 0

    for (const effect of action.effects ?? []) {
        switch (effect.type) {
            case 'cripple':
                crippleBonus = calcCrippleBonus(defender.maxHp - defender.hp, effect.ratio)
                break
            case 'self_damage':
                selfDamage = calcSelfDamage(attacker.maxHp, effect.ratio)
                break
            case 'knockback':
                knockbackDistance = effect.distance
                break
        }
    }

    return { crippleBonus, selfDamage, knockbackDistance }
}

/** 检查招式是否满足释放条件 */
export function canExecuteAction(
    action: ActionDefinition,
    attacker: Character,
    currentDistance: number,
    remainingUses?: number,
): { ok: boolean; reason?: string } {
    if (attacker.ap < action.apCost) {
        return { ok: false, reason: `AP不足 (需${action.apCost} 有${attacker.ap})` }
    }

    const weapon = WEAPONS[action.weaponType]
    if (currentDistance < weapon.range[0] || currentDistance > weapon.range[1]) {
        return { ok: false, reason: `距离不合适 (${currentDistance})` }
    }

    if (remainingUses !== undefined && remainingUses <= 0) {
        return { ok: false, reason: '已达使用上限' }
    }

    return { ok: true }
}

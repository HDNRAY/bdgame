import type { Character } from '../entities/character'
import type { ActionDefinition, ActionEffect } from '../entities/action'
import { WEAPONS, calcBaseDamage, calcDistanceMultiplier, calcCritChance, calcFinalDamage } from './damage'

export interface ResolvedDamage {
    base: number
    distanceMult: number
    isCrit: boolean
    final: number
    selfDamage: number
    crippleBonus: number
    ignoredParry: boolean
    knockbackDistance: number
    firstStrike: boolean
    isFixedDamage: boolean
}

/** 解析一个招式的所有效果，返回计算结果 */
export function resolveAction(
    action: ActionDefinition,
    attacker: Character,
    defender: Character,
    currentDistance: number,
): ResolvedDamage {
    const weapon = WEAPONS[action.weaponType]
    let base = 0
    let isFixedDamage = false
    let crippleBonus = 0
    let selfDamage = 0
    let knockbackDistance = 0
    let firstStrike = false
    let ignoredParry = false

    for (const effect of action.effects ?? []) {
        switch (effect.type) {
            case 'damage':
                base += calcBaseDamage(effect.scaling, attacker.attrs.getAll())
                break
            case 'fixed_damage':
                base = effect.value
                isFixedDamage = true
                break
            case 'cripple':
                // 崩劲：基于目标已损 HP
                crippleBonus = Math.round((defender.maxHp - defender.hp) * effect.ratio)
                break
            case 'self_damage':
                selfDamage = Math.round(attacker.maxHp * effect.ratio)
                break
            case 'knockback':
                knockbackDistance = effect.distance
                break
            case 'first_strike':
                firstStrike = true
                break
            case 'ignore_parry':
                ignoredParry = true
                break
            // status/interrupt/aoe 等由 engine 处理，这里只算伤害
        }
    }

    const distMult = isFixedDamage ? 1 : calcDistanceMultiplier(currentDistance, action.bestDistance)
    const critChance = isFixedDamage ? 0 : calcCritChance(attacker.attrs.get('technique'))
    const isCrit = Math.random() < critChance
    const final = calcFinalDamage(base + crippleBonus, distMult, isCrit)

    return { base, distanceMult: distMult, isCrit, final, selfDamage, crippleBonus, ignoredParry, knockbackDistance, firstStrike, isFixedDamage }
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

import type { ActionDefinition } from '../entities/action'
import type { Character } from '../entities/character'
import type { BattleState } from '../combat/types'
import { getWeapon } from '../data/weapons'

/** 检查招式是否满足释放条件 */
export function canExecuteAction(
    action: ActionDefinition,
    attacker: Character,
    state: BattleState,
): { ok: boolean; reason?: string } {
    if (attacker.ap < action.apCost) return { ok: false, reason: 'AP不足' }
    const weapon = attacker.weaponDef ?? getWeapon(attacker.build.weapon)
    const range = action.range ?? weapon.range
    const dist = state.distance.current
    if (dist < range[0] || dist > range[1]) return { ok: false, reason: '距离不合适' }
    if (action.requiredTags.length > 0) {
        const hasTag = action.requiredTags.some((tag) => weapon.tags.includes(tag))
        if (!hasTag) return { ok: false, reason: `需要 ${action.requiredTags.join('/')} 标签` }
    }
    if (action.canUse && !action.canUse(attacker, state)) return { ok: false, reason: '条件不满足' }
    return { ok: true }
}

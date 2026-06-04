import type { ActionDefinition } from '../entities/action'
import type { Character } from '../entities/character'
import { getWeapon } from '../data/weapons'

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

    const weapon = getWeapon(attacker.build.weapon)
    if (currentDistance < weapon.range[0] || currentDistance > weapon.range[1]) {
        return { ok: false, reason: `距离不合适 (${currentDistance})` }
    }

    // 检查招式标签与武器标签是否匹配
    if (action.requiredTags.length > 0) {
        const hasTag = action.requiredTags.some((tag) => weapon.tags.includes(tag))
        if (!hasTag) {
            return { ok: false, reason: `招式 ${action.name} 需要 ${action.requiredTags.join('/')} 标签的武器` }
        }
    }

    if (remainingUses !== undefined && remainingUses <= 0) {
        return { ok: false, reason: '已达使用上限' }
    }

    return { ok: true }
}

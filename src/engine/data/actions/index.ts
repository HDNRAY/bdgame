import type { ActionDefinition } from '../../entities/action'
import type { Tag } from '../../entities/tag'
import { PLAYER_ACTIONS } from './player'
import { SUPPORT_ACTIONS } from './support'
import { INTERNAL_ACTIONS } from './internal'
import { QI_SKILLS } from './qi'

/** 合并所有招式 */
const ALL_ACTIONS: ActionDefinition[] = [...PLAYER_ACTIONS, ...SUPPORT_ACTIONS, ...INTERNAL_ACTIONS, ...QI_SKILLS]

/** 按 ID 查找 */
export function getAction(id: string): ActionDefinition | undefined {
    return ALL_ACTIONS.find((a) => a.id === id)
}

/** 按武器标签过滤（空数组招式 = 任意武器可用） */
export function getActionsByWeapon(weaponTags: Tag[]): ActionDefinition[] {
    return ALL_ACTIONS.filter((a) => {
        if (a.requiredTags.length === 0) return true
        return a.requiredTags.some((tag) => weaponTags.includes(tag))
    })
}

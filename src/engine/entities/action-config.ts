import type { BattleState } from '../combat/types'
import type { Character } from './character'
import { getBuff } from '../../data/buffs'

/**
 * 招式的必要条件 — AI 在选择该招式前必须满足的条件
 * 所有条件类型都返回 true/false
 */
export type RequiredCondition =
    | { type: 'always' }
    | { type: 'debuff_not_active'; buffId: string }
    | { type: 'buff_not_active'; buffId: string }
    | { type: 'buff_stacks_below'; buffId: string; maxStacks: number }
    | { type: 'buff_stacks_above'; buffId: string; minStacks: number }
    | { type: 'hp_below'; ratio: number }
    | { type: 'hp_above'; ratio: number }
    | { type: 'distance_less_than'; meters: number }
    | { type: 'distance_greater_than'; meters: number }
    | { type: 'enemy_hp_below'; ratio: number }
    | { type: 'enemy_hp_above'; ratio: number }
    | { type: 'enemy_buff_not_active'; buffId: string }
    | { type: 'no_buff_with_tag'; tag: string }

/** 招式配置条目 */
export interface ActionConfig {
    actionId: string
    /** 必要条件 ID（查 CONDITION_PRESETS），缺省 = always */
    conditionId?: string
    /** 触发条件 ID（查 TRIGGER_CONDITIONS） */
    triggerId?: string
}

/** 检查必要条件是否满足 */
export function checkCondition(cond: RequiredCondition, self: Character, state: BattleState): boolean {
    const enemy = state.characters.find((c) => c.id !== self.id)
    switch (cond.type) {
        case 'always':
            return true
        case 'debuff_not_active':
            return !state.pendingBuffs.has(`${cond.buffId}::${enemy?.id}`)
        case 'buff_not_active':
            return !state.pendingBuffs.has(`${cond.buffId}::${self.id}`)
        case 'buff_stacks_below': {
            const layer = state.pendingBuffs.get(`${cond.buffId}::${self.id}`)
            return !layer || layer.restoreValue < cond.maxStacks
        }
        case 'buff_stacks_above': {
            const layer = state.pendingBuffs.get(`${cond.buffId}::${self.id}`)
            return !!layer && layer.restoreValue >= cond.minStacks
        }
        case 'hp_below':
            return self.hp / self.maxHp < cond.ratio
        case 'hp_above':
            return self.hp / self.maxHp > cond.ratio
        case 'distance_less_than': {
            const d = enemy ? state.position.distance(self.id, enemy.id) : 0
            return d < cond.meters
        }
        case 'distance_greater_than': {
            const d = enemy ? state.position.distance(self.id, enemy.id) : 0
            return d > cond.meters
        }
        case 'enemy_hp_below':
            return enemy ? enemy.hp / enemy.maxHp < cond.ratio : false
        case 'enemy_hp_above':
            return enemy ? enemy.hp / enemy.maxHp > cond.ratio : false
        case 'enemy_buff_not_active':
            return !state.pendingBuffs.has(`${cond.buffId}::${enemy?.id}`)
        case 'no_buff_with_tag':
            for (const [key] of state.pendingBuffs) {
                const parts = key.split('::')
                if (parts.length < 2 || parts[1] !== self.id) continue
                const buff = getBuff(parts[0])
                if (buff?.tags.includes(cond.tag as import('./tag').Tag)) return false
            }
            return true
    }
}

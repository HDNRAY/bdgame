import type { Tag } from '../../engine/entities/tag'
import type { BattleState } from '../../engine/combat/types'
import type { Character } from '../../engine/entities/character'
import type { ActionDefinition } from '../../engine/entities/action'
import { forEachBuffOf } from '../../engine/combat/utils'

/**
 * 招式的必要条件 — AI 在选择该招式前必须满足的条件
 * 所有条件类型都返回 true/false
 *
 * 语义：条件是**闸门**，不是优先级 —— 条件满足只代表"这招允许被选择"，
 * 是否真的出招仍由 AI 按期望伤害/内息效率评分决定（详见 docs/gameplay-guide.md「出招条件」）。
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
    | { type: 'distance_between'; min: number; max: number }
    | { type: 'enemy_hp_below'; ratio: number }
    | { type: 'enemy_hp_above'; ratio: number }
    | { type: 'enemy_buff_not_active'; buffId: string }
    | { type: 'enemy_buff_stacks_below'; buffId: string; maxStacks: number }
    | { type: 'enemy_buff_stacks_above'; buffId: string; minStacks: number }
    | { type: 'no_buff_with_tag'; tag: string }
    | { type: 'chan_above'; value: number }
    | { type: 'chan_below'; value: number }
    | { type: 'ap_above'; value: number }
    | { type: 'ap_below'; value: number }
    | { type: 'time_above'; seconds: number }

/**
 * 该招式能否挂在触发槽上。
 * 与引擎同一口径（`engine.ts` 的 `#processEmit`：触发招式 `apCost > 2` 或带 `move` 标签直接跳过），
 * UI 用它决定「触发」列是否可选，避免配出一个永远不触发的槽。
 */
export function canBeTriggerAction(def: ActionDefinition): boolean {
    return !def.tags.includes('move') && def.apCost <= 2
}

/** 招式配置条目 */
export interface ActionConfig {
    actionId: string
    /** 出招必要条件（唯一表达）——阈值可自由设定，不依赖任何预设表 */
    condition?: RequiredCondition
    /** 触发条件 ID（查 TRIGGER_CONDITIONS） */
    triggerId?: string
    /**
     * 出招优先级（越小越优先，1 起）。缺省 = 不排序，交给 AI 按期望伤害/内息效率择优。
     * 由构筑面板的拖拽顺序写入（见 withPriorityOrder）；对手数据不写 = 保持效率比择优。
     */
    priority?: number
}

/**
 * 按列表位置写入出招优先级（1..N）：面板里拖出来的顺序就是出招顺序。
 * 榜单与说明见 docs/gameplay-guide.md 第九节。
 */
export function withPriorityOrder(configs: readonly ActionConfig[]): ActionConfig[] {
    return configs.map((ac, i) => ({ ...ac, priority: i + 1 }))
}

/** 检查必要条件是否满足（热路径：每回合每候选招都调用，避免闭包/临时对象分配） */
export function checkCondition(cond: RequiredCondition, self: Character, state: BattleState): boolean {
    const enemy = state.characters.find((c) => c.id !== self.id)
    const enemyId = enemy?.id ?? ''
    switch (cond.type) {
        case 'always':
            return true
        case 'debuff_not_active':
            return !state.pendingBuffs.has(`${cond.buffId}::${enemyId}`)
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
        case 'distance_less_than':
            return (enemy ? state.position.distance(self.id, enemy.id) : 0) < cond.meters
        case 'distance_greater_than':
            return (enemy ? state.position.distance(self.id, enemy.id) : 0) > cond.meters
        case 'distance_between': {
            const d = enemy ? state.position.distance(self.id, enemy.id) : 0
            return d >= cond.min && d <= cond.max
        }
        case 'enemy_hp_below':
            return enemy ? enemy.hp / enemy.maxHp < cond.ratio : false
        case 'enemy_hp_above':
            return enemy ? enemy.hp / enemy.maxHp > cond.ratio : false
        case 'enemy_buff_not_active':
            return !state.pendingBuffs.has(`${cond.buffId}::${enemyId}`)
        case 'enemy_buff_stacks_below': {
            const layer = state.pendingBuffs.get(`${cond.buffId}::${enemyId}`)
            return !layer || layer.restoreValue < cond.maxStacks
        }
        case 'enemy_buff_stacks_above': {
            const layer = state.pendingBuffs.get(`${cond.buffId}::${enemyId}`)
            return !!layer && layer.restoreValue >= cond.minStacks
        }
        case 'no_buff_with_tag': {
            let hasTag = false
            forEachBuffOf(state.pendingBuffs, self.id, (buff) => {
                if (buff?.tags.includes(cond.tag as Tag)) {
                    hasTag = true
                    return false
                }
            })
            return !hasTag
        }
        case 'chan_above':
            return self.chan >= cond.value
        case 'chan_below':
            return self.chan < cond.value
        case 'ap_above':
            return self.ap >= cond.value
        case 'ap_below':
            return self.ap < cond.value
        case 'time_above':
            return state.turn.currentTime >= cond.seconds * 1000
    }
}

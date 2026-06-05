import type { Character } from './character'

/** 触发时机（EventBus 事件） */
export type TriggerEvent =
    | 'on_attack'
    | 'on_hit'
    | 'on_take_damage'
    | 'on_dodge'
    | 'on_parry'
    | 'on_dodged'
    | 'on_parried'
    | 'on_buff'
    | 'on_debuff'
    | 'on_move'
    | 'turn_start'
    | 'turn_end'
    | 'hp_below'
    | 'before_main'
    | 'after_main'
    | 'before_turn_end'
    | 'battle_start'

/** 触发条件上下文 */
export interface ConditionContext {
    actor: Character
    distance: number
}

/** 触发条件 */
export interface Condition {
    type: TriggerEvent
    check?: (ctx: ConditionContext) => boolean
}

/** 可供玩家选择的触发条件 */
export interface TriggerCondition extends Condition {
    id: string
    name: string
    description: string
    apCost?: number
    maxUses?: number
}

/** 玩家装备的触发器槽 */
export interface TriggerSlot {
    condition: Condition
    actionId: string
}

/** 计算触发槽数: max(1, floor(wisdom/4)) */
export function calcTriggerSlots(wisdom: number): number {
    return Math.max(1, Math.floor(wisdom / 4))
}

import type { Character } from './character'
import type { EffectDef } from './action'
import type { BattleEngine } from '../combat/engine'

/** 触发时机（EventBus 事件） */
export type TriggerEvent =
    | 'on_attack'
    | 'on_hit'
    | 'on_dealt_damage'
    | 'on_was_hit'
    | 'on_took_damage'
    | 'on_dodge'
    | 'on_parry'
    | 'on_dodged'
    | 'on_parried'
    | 'on_buff'
    | 'on_debuff'
    | 'on_poison'
    | 'on_burn'
    | 'on_bleed'
    | 'on_stun'
    | 'on_paralyze'
    | 'on_sand_blind'
    | 'on_disarm'
    | 'on_move'
    | 'on_opponent_move'
    | 'turn_start'
    | 'turn_end'
    | 'hp_below'
    | 'battle_start'
    | 'on_equip'
    | 'on_crit'
    | 'on_pre_action'
    | 'chan_overflow'
    | 'on_action_trigger'

/** 触发条件上下文 */
export interface ConditionContext {
    actor: Character
    distance: number
    /** 移动事件的位移量（负=靠近，正=远离） */
    moveDelta?: number
    engine?: BattleEngine
}

/** 触发条件 */
export interface Condition {
    type: TriggerEvent
    /** 仅当触发事件匹配此 buffId 时生效（on_buff 专用） */
    buffId?: string
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
    actionId?: string
    /** 内联效果（优先于 actionId） */
    effects?: EffectDef[]
}

/** 计算触发槽数: max(1, floor(wisdom/4)) */
export function calcTriggerSlots(wisdom: number): number {
    return Math.max(1, Math.floor(wisdom / 4))
}

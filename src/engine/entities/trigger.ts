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
    | 'turn_start'
    | 'turn_end'
    | 'hp_below'

export type TriggerTag = 'defensive' | 'offensive' | 'mobility' | 'utility' | 'counter' | 'recovery' | 'control'

/** 触发器槽：一个触发时机 + 一个触发的招式 */
export interface TriggerSlot {
    triggerId: string
    actionId: string
}

/** 触发器定义（只定义时机和条件，不绑定具体招式） */
export interface TriggerDefinition {
    id: string
    name: string
    description: string
    event: TriggerEvent
    condition?: {
        hpBelow?: number
        enemyDistance?: number
        hasStatus?: string
    }
    slotCost: number
    apCost?: number
    maxUses?: number
    tags: TriggerTag[]
}

/** 计算触发槽数: max(1, floor(wisdom/4)) */
export function calcTriggerSlots(wisdom: number): number {
    return Math.max(1, Math.floor(wisdom / 4))
}

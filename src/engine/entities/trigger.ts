/** 触发时机（EventBus 事件） */
export type TriggerEvent =
    | 'on_attack'          // 自己发起攻击时
    | 'on_hit'             // 自己命中对手时
    | 'on_take_damage'     // 自己受伤时
    | 'on_dodge'           // 自己闪避时
    | 'on_parry'           // 自己招架时
    | 'on_dodged'          // 自己被闪避时
    | 'on_parried'         // 自己被招架时
    | 'on_kill'            // 自己击败对手时
    | 'turn_start'         // 自己 event 开始时
    | 'turn_end'           // 自己 event 结束时
    | 'hp_below'           // 血量低于阈值

export type TriggerTag = 'defensive' | 'offensive' | 'mobility' | 'utility' | 'counter' | 'recovery' | 'control'

/** 触发器定义 */
export interface TriggerDefinition {
    id: string
    name: string
    description: string
    event: TriggerEvent
    /** 额外条件（如血量阈值、距离等） */
    condition?: {
        hpBelow?: number        // 仅 hp_below 时有效
        enemyDistance?: number  // 对手在特定距离
        hasStatus?: string      // 自身有某状态
    }
    /** 效果参数 */
    effects: TriggerEffect[]
    slotCost: number           // 默认 1
    apCost?: number            // 从下回合 AP 扣
    maxUses?: number           // 整场限次
    tags: TriggerTag[]
}

export type TriggerEffect =
    | { type: 'damage'; value: number; scaling?: Partial<Record<string, number>> }
    | { type: 'heal'; value: number; ratio?: number }  // value 固定值, ratio HP比例
    | { type: 'status'; status: string; stacks: number }
    | { type: 'buff'; stat: string; value: number; duration: 'turn' | 'battle' }
    | { type: 'debuff'; stat: string; value: number; duration: 'turn' | 'battle' }
    | { type: 'modify_turn'; deltaMs: number }         // 加速/减速
    | { type: 'counter_attack'; damageRatio: number }  // 反击（伤害比例）
    | { type: 'cleanse' }                               // 驱散负面状态

/** 计算触发槽数: max(1, floor(wisdom/4)) */
export function calcTriggerSlots(wisdom: number): number {
    return Math.max(1, Math.floor(wisdom / 4))
}

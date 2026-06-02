import type { AttrName } from './attributes'
import type { WeaponType } from '../calc/damage'

/** 效果类型 */
export type EffectTag = 'stagger' | 'paralyze' | 'poison' | 'interrupt' | 'bleed' | 'first_strike' | 'counter' | 'aoe' | 'ignore_parry' | 'fixed_damage' | 'self_damage' | 'knockback' | 'cripple'

/** 招式定义 —— 纯数据 */
export interface ActionDefinition {
    id: string
    name: string
    weaponType: WeaponType
    apCost: number
    bestDistance: number
    tags: EffectTag[]
    /** 特殊效果参数 */
    effects?: ActionEffect[]
    /** 每场限用次数 */
    maxUses?: number
    /** 辅招？不占主招名额 */
    bonus?: boolean
}

export type ActionEffect =
    | { type: 'damage'; scaling: Partial<Record<AttrName, number>> }
    | { type: 'fixed_damage'; value: number }
    | { type: 'status'; status: EffectTag; stacks: number }
    | { type: 'cripple'; ratio: number }               // 崩劲：目标已损HP × ratio
    | { type: 'self_damage'; ratio: number }            // 自伤：自身HP × ratio
    | { type: 'first_strike' }                          // 先制
    | { type: 'counter_on_dodge'; damageRatio: number } // 被闪时反击
    | { type: 'aoe_range'; range: number }              // 范围
    | { type: 'ignore_parry' }
    | { type: 'interrupt' }
    | { type: 'knockback'; distance: number }
    | { type: 'limit_uses'; max: number }

/** 主招队列配置 —— 玩家可配置顺序 */
export interface ActionQueueEntry {
    actionId: string
    priority: number  // 越低越优先检测
}

/** 辅招触发时机 */
export type BonusTiming =
    | 'after_main'
    | 'before_turn_end'
    | 'on_hit'
    | 'on_take_damage'
    | 'on_dodge'
    | 'on_parry'
    | 'turn_start'

/** 辅招触发条件 */
export interface BonusCondition {
    hpBelow?: number
    enemyDistance?: number
    hasStatus?: string
    apRemaining?: number
}

/** 辅招定义 */
export interface BonusActionDefinition {
    actionId: string
    timing: BonusTiming
    condition?: BonusCondition
}

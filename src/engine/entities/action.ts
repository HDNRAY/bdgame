import type { AttrName } from './attributes'
import type { WeaponTag } from '../data/weapons'
import type { Condition } from './trigger'
import type { StatusType } from './status'
import type { GameEntity } from './base'

/** 效果类型 */
export type EffectTag =
    | 'stagger'
    | 'paralyze'
    | 'poison'
    | 'interrupt'
    | 'stun'
    | 'cleanse'
    | 'bleed'
    | 'first_strike'
    | 'counter'
    | 'aoe'
    | 'ignore_parry'
    | 'fixed_damage'
    | 'self_damage'
    | 'knockback'
    | 'cripple'

/** 招式定义 —— 纯数据 */
export interface ActionDefinition extends GameEntity {
    id: string
    name: string
    description: string
    /** 需要的武器标签，空数组 = 不限制 */
    requiredTags: WeaponTag[]
    apCost: number
    tags: EffectTag[]
    /** 特殊效果参数 */
    effects?: ActionEffect[]
    /** 每场限用次数 */
    maxUses?: number
    /** 辅招？不占主招名额 */
    bonus?: boolean
    /** 辅招触发条件（仅 bonus=true 时有效） */
    bonusTiming?: Condition
    /** 辅招效果描述（如 "力量翻倍1回合"），支持多个同时触发 */
    triggerEffect?: BonusTriggerEffect[]
    /** 招式额外前摇 */
    extraPreDelay?: number
    /** 招式额外硬直 */
    extraStunTime?: number
    /** 招式自带的距离范围（不设则用武器距离） */
    range?: [number, number]
}

/** buff 持续时间：{ attr: '属性名', multiplier: 系数 } = 属性×系数 ms，系数大≈永久 */
export type BuffDuration = { attr: AttrName; multiplier: number }

export type BonusTriggerEffect =
    | { type: 'stat_multiply'; stat: string; multiplier: number; duration: BuffDuration; restoreValue?: number }
    | { type: 'stat_buff'; attrs: Record<string, number>; duration: BuffDuration }
    | { type: 'stat_restore'; stat: string; value: number } // 用于 buff 消失时恢复
    | { type: 'buff_end'; buffId: string } // 标记 buff 到期事件
    | { type: 'heal'; value: number; ratio?: number }
    | { type: 'guarantee_hit' }
    | { type: 'guarantee_crit' }
    | { type: 'ignore_parry_next' }

export type ActionEffect =
    | { type: 'damage'; scaling: Partial<Record<AttrName, number>> }
    | { type: 'fixed_damage'; value: number }
    | { type: 'status'; status: EffectTag; stacks: number; chance: number }
    | { type: 'cripple'; ratio: number } // 崩劲：目标已损HP × ratio
    | { type: 'self_damage'; ratio: number } // 自伤：自身HP × ratio
    | { type: 'first_strike' } // 先制
    | { type: 'counter_on_dodge'; damageRatio: number } // 被闪时反击
    | { type: 'aoe_range'; range: number } // 范围
    | { type: 'ignore_parry' }
    | { type: 'interrupt' }
    | { type: 'knockback'; distance: number }
    | { type: 'limit_uses'; max: number }
    | { type: 'modify_turn'; deltaMs: number } // 加速/减速
    | { type: 'cleanse'; statuses?: StatusType[] } // 驱散
    | { type: 'counter_damage'; ratio: number } // 反击：基于所收伤害比例
    | { type: 'heal'; value: number; ratio?: number } // 回复：固定值 + 最大HP%

/** 主招队列配置 —— 玩家可配置顺序 */
export interface ActionQueueEntry {
    actionId: string
    priority: number // 越低越优先检测
}

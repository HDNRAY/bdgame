import type { AttrName } from './attributes'
import type { GameEntity } from './base'
import type { EffectDef } from './action'
import type { TriggerSlot } from './trigger'

/** 功法 / 被动技能 */
export interface Passive extends GameEntity {
    /** 激活时执行的持久效果 */
    effects?: EffectDef[]
    /** 带来的额外 trigger slot */
    triggers?: TriggerSlot[]
}

/** 天赋（绝学）—— 属性达标解锁的内在力量 */
export interface Talent extends Passive {
    /** 解锁条件（>=） */
    requireAttrsMin: Partial<Record<AttrName, number>>
    /** 解锁条件（<=） */
    requireAttrsMax?: Partial<Record<AttrName, number>>
}

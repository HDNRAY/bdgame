import type { AttrName } from './attributes'
import type { GameEntity } from './base'
import type { EffectDef } from './action'
import type { TriggerSlot } from './trigger'

/** 功法 / 天赋（绝学）—— 被动技能，含属性达标解锁的天赋 */
export interface Passive extends GameEntity {
    id: string
    name: string
    description: string
    /** 解锁条件（空对象=无条件） */
    requireAttrs?: Partial<Record<AttrName, number>>
    /** 激活时执行的持久效果 */
    effects?: EffectDef[]
    /** 带来的额外 trigger slot */
    triggers?: TriggerSlot[]
    /** 提供的修饰器名 */
    modifiers?: string[]
}

import type { AttrName } from './attributes'
import type { GameEntity } from './base'
import type { ActionDefinition } from './action'
import type { EffectSlot } from './trigger'

export type ActionEnhancer = (def: ActionDefinition) => ActionDefinition

/** 功法 / 被动技能 */
export interface Passive extends GameEntity {
    /**
     * 时机 → 效果列表。构造期贡献写 `condition.type === 'on_construct'` 槽
     * （其 `apply` 走来源层账）；其余槽是运行时触发（见 src/data/triggers.ts）。
     */
    effects?: EffectSlot[]
    /** 招式强化钩子（构造期执行） */
    actionEnhancer?: ActionEnhancer
    /** 功法赋予角色的招式 */
    grantsActions?: string[]
    /** 属性要求（不达标则不生效） */
    requireAttrsMin?: Partial<Record<AttrName, number>>
}

/** 天赋（绝学）—— 属性达标解锁的内在力量 */
export interface Talent extends Passive {
    /** 解锁条件（>=） */
    requireAttrsMin: Partial<Record<AttrName, number>>
    /** 解锁条件（<=） */
    requireAttrsMax?: Partial<Record<AttrName, number>>
}

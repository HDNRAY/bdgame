import type { AttrName } from './attributes'
import type { TriggerSlot } from './trigger'
import type { Reward } from '../data/rewards'

/** 战前角色配置（可序列化） */
export interface CharacterBuild {
    id: string
    name: string
    /** 背景 ID */
    background: string
    /** 最终属性值 */
    baseAttrs: Partial<Record<AttrName, number>>
    /** 武器 ID */
    weapon: string
    /** 像素造型 ID */
    spriteId?: string
    /** 非属性奖励列表 */
    rewards: Reward[]
    /** 触发器槽 */
    triggers: TriggerSlot[]
}

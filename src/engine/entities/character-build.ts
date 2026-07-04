import type { AttrName } from './attributes'
import type { Reward } from './reward'
import type { ActionConfig } from './action-config'

/** 战斗风格 */
export type BattleStyle = 'melee' | 'mid' | 'ranged'

/** 战前角色配置（可序列化） */
export interface CharacterBuild {
    id: string
    name: string
    /** 故事/叙事文本 */
    story?: string
    /** 战斗风格，缺省 = 随武器自动判断 */
    battleStyle?: BattleStyle
    /** 战前台词 */
    taunt?: string
    /** 最终属性值 */
    baseAttrs: Partial<Record<AttrName, number>>
    /** 武器 ID */
    weapon: string
    /** 像素造型 ID */
    spriteId?: string
    /** 非属性奖励列表 */
    rewards: Reward[]
    /** 招式配置表（顺序+条件+触发），缺省按 rewards 顺序+always */
    actionConfigs?: ActionConfig[]
}

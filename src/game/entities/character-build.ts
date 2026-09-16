import type { AttrName } from '../../engine/entities/attributes'
import type { Reward } from './reward'
import type { ActionConfig } from './action-config'

/** 战斗风格 */
export type BattleStyle = 'melee' | 'mid' | 'ranged' | 'clinch'

/**
 * 战前角色配置（可序列化）。
 * 会被写进存档并在三处读回：玩家构筑编辑器（useBuildCharacter）、隐藏boss（championBossBuild，
 * 含 meta 存档与 `npm run tour --champion=<build.json>`）、DevMode 构筑试炼（BuildSim.loadPersisted）。
 * 加字段（尤其嵌套结构）时这三处要一起考虑。
 */
export interface CharacterBuild {
    id: string
    name: string
    /** 故事/叙事文本 */
    story?: string
    /** 战斗风格（显式必填，不再自动判定） */
    battleStyle: BattleStyle
    /** 战前台词 */
    taunt?: string
    /** 最终属性值 */
    baseAttrs: Partial<Record<AttrName, number>>
    /** 武器 ID */
    weapon: string
    /** 副手武器 ID */
    offhand?: string
    /** 像素造型 ID */
    spriteId?: string
    /** 非属性奖励列表 */
    rewards: Reward[]
    /** 招式配置表（顺序+条件+触发），缺省按 rewards 顺序+always */
    actionConfigs?: ActionConfig[]
}

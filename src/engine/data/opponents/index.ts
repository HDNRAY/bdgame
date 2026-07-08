export { ZHANGLIE } from './zhanglie'
export { LAIFENG } from './laifeng'
export { XUANJI } from './xuanji'
export { LAYUE } from './layue'
export { YIDAO } from './yidao'
export { SANGYUAN } from './sangyuan'
export { BAIHU } from './baihu'
export { LUEYING } from './lueying'
export { LIUXIGUA } from './liuxigua'
export { LUHONGTI } from './luhongti'
export { QILAN } from './qilan'
export { LONGNV } from './longnv'
export { YANGGUO } from './yangguo'
export { AJIU } from './ajiu'
export { WUKONG } from './wukong'
export { XUNXIANG } from './xunxiang'
export { WUZUI } from './wuzui'
export { JUNSHI } from './junshi'
export { FENGSHUI } from './fengshui'
export { DUOER } from './duoer'
export { HEIYUN } from './heiyun'
export { HAORAN } from './haoran'
import type { CharacterBuild, BattleStyle } from '../../entities/character-build'
import type { BattleState, ActionCommand } from '../../combat/types'
import type { Character } from '../../entities/character'
import type { Reward } from '../../entities/reward'
import type { ActionConfig } from '../../entities/action-config'
import { simpleGenerate } from '../../systems/character-gen'

import { ZHANGLIE } from './zhanglie'
import { LAIFENG } from './laifeng'
import { XUANJI } from './xuanji'
import { LAYUE } from './layue'
import { YIDAO } from './yidao'
import { SANGYUAN } from './sangyuan'
import { BAIHU } from './baihu'
import { LUEYING } from './lueying'
import { LIUXIGUA } from './liuxigua'
import { LUHONGTI } from './luhongti'
import { QILAN } from './qilan'
import { LONGNV } from './longnv'
import { YANGGUO } from './yangguo'
import { AJIU } from './ajiu'
import { WUKONG } from './wukong'
import { XUNXIANG } from './xunxiang'
import { JUNSHI } from './junshi'
import { DUOER } from './duoer'
import { FENGSHUI } from './fengshui'
import { WUZUI } from './wuzui'
import { HEIYUN } from './heiyun'
import { HAORAN } from './haoran'

/** 对手定义（纯数据） */
export interface OpponentDef {
    id: string
    name: string
    story?: string
    battleStyle?: BattleStyle
    weapon: string
    rewards: Reward[]
    actionConfigs?: ActionConfig[]
    targetAttrs: Record<string, number>
    taunt?: (enemy: OpponentDef) => string
    planEvent?: (self: Character, state: BattleState) => ActionCommand[] | null
}

/** 通用生成器：按 n 生成对手 build */
export function gen(def: OpponentDef, n: number): CharacterBuild {
    return simpleGenerate(def, def.weapon, def.rewards, n, def.actionConfigs)
}

/** 所有对手 */
export const OPPONENTS: OpponentDef[] = [
    /** 拳掌 */
    QILAN, // 江湖新人
    LAIFENG,
    WUZUI, // 饮酒结拜
    SANGYUAN, // 归海楼
    /** 刀剑 */
    LUHONGTI, // 军方
    AJIU, // 组织
    FENGSHUI, // 饮酒结拜
    HAORAN, // 饮酒结拜
    /** 双持 */
    LAYUE, // 天生道种师姐
    BAIHU,
    LONGNV, // 六绝之逸
    /** 长柄 */
    ZHANGLIE, // 组织(变节卧底)
    /** 棍 */
    WUKONG, // 六绝之破
    /** 御物 */
    XUANJI, // 玄门
    JUNSHI, // 组织
    HEIYUN, // 玄门(退出) 饮酒结拜
    /** 巨武 */
    LIUXIGUA, // 六绝之闪
    YANGGUO, // 六绝之观
    YIDAO, // 太刀 归海楼
    /** 匕首 */
    LUEYING, // 军方
    DUOER, // 组织
    /** 暗器 */
    XUNXIANG, // 六绝之悟
]

/** 按 ID 查找对手 def */
export function getOpponentDef(id: string): OpponentDef | undefined {
    return OPPONENTS.find((o) => o.id === id)
}

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
export { JUNSHI } from './junshi'
export { DUOER } from './duoer'
import type { CharacterBuild } from '../../entities/character-build'
import type { BattleState, ActionCommand } from '../../combat/types'
import type { Character } from '../../entities/character'
import type { Reward } from '../../entities/reward'
import type { ActionConfig } from '../../entities/action-config'
import { simpleGenerate } from '../../systems/character-gen'

export { passive, artifact, action } from '../../systems/reward-pool'
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
import { AttackStyle } from '../../ai/move-planner'

/** 对手定义（纯数据） */
export interface OpponentDef {
    id: string
    name: string
    story?: string
    battleStyle?: AttackStyle
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
    // 拳掌
    QILAN,
    LAIFENG,
    // 刀剑
    LUHONGTI,
    SANGYUAN,
    AJIU,
    // 双持
    LAYUE,
    BAIHU,
    LONGNV,
    // 长柄
    ZHANGLIE,
    // 棍
    WUKONG,
    // 御物
    XUANJI,
    JUNSHI,
    // 巨武
    LIUXIGUA,
    YANGGUO,
    // 太刀
    YIDAO,
    // 匕首
    LUEYING,
    DUOER,
    // 暗器
    XUNXIANG,
]

/** 按 ID 查找对手 def */
export function getOpponentDef(id: string): OpponentDef | undefined {
    return OPPONENTS.find((o) => o.id === id)
}

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

/** 对手定义（纯数据） */
export interface OpponentDef {
    id: string
    name: string
    story?: string
    battleStyle: string
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
    QILAN,
    LAIFENG,
    SANGYUAN,
    LUHONGTI,
    AJIU,
    LAYUE,
    BAIHU,
    LONGNV,
    ZHANGLIE,
    WUKONG,
    XUANJI,
    LIUXIGUA,
    YANGGUO,
    YIDAO,
    LUEYING,
    XUNXIANG,
]

/** 按 ID 查找对手 def */
export function getOpponentDef(id: string): OpponentDef | undefined {
    return OPPONENTS.find((o) => o.id === id)
}

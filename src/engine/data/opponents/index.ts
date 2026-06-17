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

import type { CharacterBuild } from '../../entities/character-build'
import type { BattleState, ActionCommand } from '../../combat/types'
import type { Character } from '../../entities/character'
import type { Reward } from '../rewards'
import type { DamageEstimate } from '../../ai/expected-damage'
import type { AttackStyle } from '../../ai/move-planner'
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

/** 对手定义 */
export interface OpponentDef {
    id: string
    name: string
    /** 根据 n 返回对应强度的 build */
    generate: (n: number) => CharacterBuild
    /** 自定义 AI（返回 null = 用默认） */
    planEvent?: (self: Character, state: BattleState) => ActionCommand[] | null
    /** AI 覆盖配置 */
    aiOverrides?: AiOverrides
}

/** AI 行为覆盖 */
export interface AiOverrides {
    /** 对候选招式打分加权（返回 actionId → 额外分值） */
    actionPriority?: (candidates: DamageEstimate[], self: Character, state: BattleState) => Record<string, number>
    /** 强制攻击风格 */
    forceStyle?: AttackStyle
    /** 保留 AP（不放主招/移动） */
    reserveAp?: number
    /** 不使用的辅助招式（actionId 列表） */
    supportBlacklist?: string[]
}

/** 奖励快捷函数 */
export const passive = (id: string): Reward => ({ type: 'passive', id, name: id, description: '', tags: [] })
export const artifact = (id: string): Reward => ({ type: 'artifact', id, name: id, description: '', tags: [] })
export const action = (id: string): Reward => ({ type: 'action', id, name: id, description: '', tags: [] })

/** 所有对手 */
export const OPPONENTS: OpponentDef[] = [
    QILAN,
    SANGYUAN,
    ZHANGLIE,
    LAIFENG,
    XUANJI,
    LAYUE,
    YIDAO,
    BAIHU,
    LUEYING,
    LIUXIGUA,
    LUHONGTI,
    LONGNV,
]

/** 按 ID 查找对手 def */
export function getOpponentDef(id: string): OpponentDef | undefined {
    return OPPONENTS.find((o) => o.id === id)
}

/** 随机选一个对手，按 n 生成 build */
export function generateOpponent(n: number): { def: OpponentDef; build: CharacterBuild } {
    const def = OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)]
    return { def, build: def.generate(n) }
}

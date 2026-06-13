export type { OpponentDef } from './base'
export { passive, artifact, action } from './base'
export { ZHANGLIE } from './zhanglie'
export { LAIFENG } from './laifeng'
export { XUANJI } from './xuanji'
export { LAYUE } from './layue'
export { YIDAO } from './yidao'
export { SANGYUAN } from './sangyuan'
export { BAIHU } from './baihu'
export { LUEYING } from './lueying'
export { LIUXIGUA } from './liuxigua'

import type { CharacterBuild } from '../../entities/character-build'
import { ZHANGLIE } from './zhanglie'
import { LAIFENG } from './laifeng'
import { XUANJI } from './xuanji'
import { LAYUE } from './layue'
import { YIDAO } from './yidao'
import { SANGYUAN } from './sangyuan'
import { BAIHU } from './baihu'
import { LUEYING } from './lueying'
import { LIUXIGUA } from './liuxigua'
import type { OpponentDef } from './base'

/** 所有对手 */
export const OPPONENTS: OpponentDef[] = [ZHANGLIE, LAIFENG, XUANJI, LAYUE, YIDAO, SANGYUAN, BAIHU, LUEYING, LIUXIGUA]

/** 按 ID 查找对手 def */
export function getOpponentDef(id: string): OpponentDef | undefined {
    return OPPONENTS.find((o) => o.id === id)
}

/** 随机选一个对手，按 n 生成 build */
export function generateOpponent(n: number): { def: OpponentDef; build: CharacterBuild } {
    const def = OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)]
    return { def, build: def.generate(n) }
}

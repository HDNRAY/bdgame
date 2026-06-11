export type { OpponentDef } from './base'
export { passive, implant, action } from './base'
export { ZHANGLIE } from './zhanglie'
export { PLAYER } from './player'
export { XUANJI } from './xuanji'

import type { CharacterBuild } from '../../entities/character-build'
import { ZHANGLIE } from './zhanglie'
import { PLAYER } from './player'
import { XUANJI } from './xuanji'
import type { OpponentDef } from './base'

/** 所有对手 */
export const OPPONENTS: OpponentDef[] = [ZHANGLIE, PLAYER, XUANJI]

/** 按 ID 查找对手 def */
export function getOpponentDef(id: string): OpponentDef | undefined {
    return OPPONENTS.find((o) => o.id === id)
}

/** 随机选一个对手，按 n 生成 build */
export function generateOpponent(n: number): { def: OpponentDef; build: CharacterBuild } {
    const def = OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)]
    return { def, build: def.generate(n) }
}

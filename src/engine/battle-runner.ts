import { Character } from './entities/character'
import { BattleEngine } from './combat/engine'
import type { EventPlan } from './combat/types'
import { planEvent } from './ai'

/** 最大行动数限制，防止死循环 */
const MAX_ACTIONS = 300

/** 运行一场完整战斗 */
export function runBattle(charA: Character, charB: Character): { winner: string; engine: BattleEngine } {
    const engine = new BattleEngine(charA, charB)
    const { state } = engine
    let actionCount = 0

    while (state.phase === 'fighting') {
        if (++actionCount > MAX_ACTIONS) {
            state.phase = 'finished'
            break
        }
        const planFn: EventPlan = (_self) => planEvent(_self, state)
        if (!engine.runEvent(planFn)) break
    }
    const survivor = state.characters.find((c) => c.isAlive())
    const winner = survivor?.name ?? state.lastWinner ?? '平局'
    return { winner, engine }
}

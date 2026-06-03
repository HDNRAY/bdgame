import { Character } from './entities/character'
import { BattleEngine } from './combat/engine'
import type { EventPlan } from './combat/types'
import { planEvent } from './ai'

/** 运行一场完整战斗 */
export function runBattle(
    charA: Character,
    charB: Character,
    actionIdA?: string,
    actionIdB?: string,
): { winner: string; engine: BattleEngine } {
    const engine = new BattleEngine(charA, charB)
    const { state } = engine

    while (state.phase === 'fighting') {
        const planFn: EventPlan = (self, _enemy, _state) => {
            const useId = self.id === charA.id ? actionIdA : actionIdB
            return planEvent(self, _state, useId)
        }
        if (!engine.runEvent(planFn)) break
    }
    const survivor = state.characters.find((c) => c.isAlive())
    return { winner: survivor?.name ?? '平局', engine }
}

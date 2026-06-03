import { Character } from './entities/character'
import { BattleEngine } from './combat/engine'
import type { EventPlan } from './combat/engine'
import { planEvent } from './ai'

/** 一场行动序列的完整模拟 */
export function simulateFight(
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
    const survivor = state.characters.find((c) => c.isAlive())!
    return { winner: survivor.name, engine }
}

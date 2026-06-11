import { Character } from './entities/character'
import { BattleEngine } from './combat/engine'
import type { EventPlan } from './combat/types'
import type { LogEvent } from './combat/log-events'
import { planEvent } from './ai'

/** 最大行动数限制，防止死循环 */
const MAX_ACTIONS = 300

/** 运行一场完整战斗（自动 clone 角色，不污染原始数据） */
export function runBattle(
    charA: Character,
    charB: Character,
    onLog?: (event: LogEvent) => void,
): { winner: string; engine: BattleEngine } {
    const a = charA.cloneForBattle()
    const b = charB.cloneForBattle()
    const engine = new BattleEngine(a, b)
    if (onLog) engine.onLog(onLog)
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
    const winner = survivor?.id ?? state.lastWinner ?? '平局'
    return { winner, engine }
}

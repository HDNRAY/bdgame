import { Character } from './entities/character'
import { BattleEngine } from './combat/engine'
import type { EventPlan, ActionCommand } from './combat/types'
import type { LogEvent } from './combat/log-events'
import { planEvent } from './ai'
import { getOpponentDef } from './data/opponents/index'

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

    // 收集自定义 AI
    const customPlans = new Map<string, (self: Character, enemy: Character, s: typeof state) => ActionCommand[]>()
    for (const char of [a, b]) {
        const def = getOpponentDef(char.build.id)
        if (def?.planEvent) {
            const fn = def.planEvent
            customPlans.set(char.id, (self, _enemy, s) => fn(self, s) ?? planEvent(self, s))
        }
    }

    while (state.phase === 'fighting') {
        if (++actionCount > MAX_ACTIONS) {
            state.phase = 'finished'
            break
        }
        const planFn: EventPlan = (_self, _enemy, _state) => {
            const custom = customPlans.get(_self.id)
            return custom ? custom(_self, _enemy, _state) : planEvent(_self, _state)
        }
        if (!engine.runEvent(planFn)) break
    }
    const survivor = state.characters.find((c) => c.isAlive())
    const winner = survivor?.id ?? state.lastWinner ?? '平局'
    return { winner, engine }
}

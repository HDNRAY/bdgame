import { Character } from './entities/character'
import { BattleEngine } from './combat/engine'
import type { EventPlan, ActionCommand } from './combat/types'
import type { LogEvent } from './combat/log-events'
import { planEvent } from './ai'
import { getOpponentDef } from '../data/opponents/index'
import type { CharacterBuild } from '../game/entities/character-build'

/** 最大战斗时长限制（ms），防死循环 */
const MAX_BATTLE_TIME_MS = 300_000
/** 系统事件上限，防 bug 导致无限循环 */
const MAX_SYSTEM_EVENTS = 10000

/** 运行一场完整战斗（自动 clone 角色，不污染原始数据） */
export function runBattle(
    charA: Character,
    charB: Character,
    onLog?: (event: LogEvent) => void,
    distance = 4,
): { winner: string; engine: BattleEngine } {
    const a = charA.cloneForBattle()
    const b = charB.cloneForBattle()
    const engine = new BattleEngine(a, b, distance)
    if (onLog) engine.onLog(onLog)
    const { state } = engine
    let systemCount = 0

    // 收集自定义 AI
    const customPlans = new Map<string, (self: Character, enemy: Character, s: typeof state) => ActionCommand[]>()
    for (const char of [a, b]) {
        const def = getOpponentDef(char.build.id)
        if (def?.planEvent) {
            const fn = def.planEvent
            customPlans.set(char.id, (self, _enemy, s) => fn(self, s) ?? planEvent(self, s))
        }
    }

    const planFn: EventPlan = (_self, _enemy, _state) => {
        const custom = customPlans.get(_self.id)
        return custom ? custom(_self, _enemy, _state) : planEvent(_self, _state)
    }

    while (state.phase === 'fighting') {
        // 系统事件（tick 回血等）不消耗行动计数，不参与 MAX_BATTLE_TIME_MS 限制
        const nextEvent = state.turn.peek()
        if (nextEvent?.type === 'system') {
            if (++systemCount > MAX_SYSTEM_EVENTS) {
                state.phase = 'finished'
                break
            }
            if (!engine.runEvent(planFn)) break
            continue
        }
        if (state.turn.currentTime > MAX_BATTLE_TIME_MS) {
            state.phase = 'finished'
            break
        }
        if (!engine.runEvent(planFn)) break
    }
    const alive = state.characters.filter((c) => c.isAlive())
    let winner: string
    if (alive.length === 1) {
        winner = alive[0].id
    } else {
        // 按剩余 HP 百分比决胜（精确到小数点后1位）
        const pcts = state.characters.map((c) => Math.round((c.hp / c.maxHp) * 1000) / 10)
        if (pcts[0] > pcts[1]) {
            winner = state.characters[0].id
            engine.emitLog({ type: 'defeat', loserId: state.characters[1].id, winnerId: state.characters[0].id })
        } else if (pcts[1] > pcts[0]) {
            winner = state.characters[1].id
            engine.emitLog({ type: 'defeat', loserId: state.characters[0].id, winnerId: state.characters[1].id })
        } else {
            winner = '平局'
        }
    }
    return { winner, engine }
}

/** 批量模拟 N 场战斗，返回胜率统计 */
export function simulateWinRate(
    buildA: CharacterBuild,
    buildB: CharacterBuild,
    n: number = 200,
    distance = 4,
    abortSignal?: { get aborted(): boolean },
): { aWins: number; bWins: number; draws: number; aRate: number; bRate: number } {
    let aWins = 0
    let bWins = 0
    let draws = 0

    for (let i = 0; i < n; i++) {
        if (abortSignal?.aborted) break
        const a = new Character(buildA)
        const b = new Character(buildB)
        const { winner } = runBattle(a, b, undefined, distance)
        if (winner === buildA.id) aWins++
        else if (winner === buildB.id) bWins++
        else draws++
    }

    return {
        aWins,
        bWins,
        draws,
        aRate: n > 0 ? aWins / n : 0,
        bRate: n > 0 ? bWins / n : 0,
    }
}

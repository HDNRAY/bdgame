import { describe, it, expect, vi } from 'vitest'
const battle = vi.hoisted(() => ({ playerWins: true }))
vi.mock('../../engine/battle-runner', () => ({
    runBattle: (_p: unknown, enemy: { id: string }) => ({ winner: battle.playerWins ? 'player' : enemy.id, engine: { state: { log: { getAll: () => [] } } } }),
    simulateWinRate: () => ({ aWins: 1, bWins: 0 }),
}))
import { RogueliteRun } from '../roguelite/engine'
import type { GameState } from '../entities/state'

function drive(run: RogueliteRun): GameState {
    let state = run.getState()
    let guard = 0
    while (!state.finished && guard++ < 800) {
        const round = state.rounds[state.rounds.length - 1]
        if (!round || round.choices.length === 0) break
        run.selectChoice(0)
        state = run.getState()
    }
    return state
}

describe('随机全流程冒烟（不固定 Math.random，覆盖不同故事/事件路径）', () => {
    it('20 局全胜：全部走完且不崩溃', () => {
        battle.playerWins = true
        for (let i = 0; i < 20; i++) {
            const s = drive(new RogueliteRun())
            expect(s.finished, `第 ${i} 局未结束 story=${s.build.story} node=${s.nodeIndex}`).toBe(true)
        }
    })

    it('20 局全败：全部以 game over 结束（受伤或淘汰）且不崩溃', () => {
        battle.playerWins = false
        for (let i = 0; i < 20; i++) {
            const s = drive(new RogueliteRun())
            expect(s.finished, `第 ${i} 局未 game over story=${s.build.story} node=${s.nodeIndex}`).toBe(true)
            expect(s.nodeIndex, `第 ${i} 局走完了全图 story=${s.build.story}`).toBeLessThan(34)
        }
    })
})

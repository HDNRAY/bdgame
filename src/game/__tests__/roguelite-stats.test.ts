import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RogueliteRun } from '../roguelite/engine'

/**
 * 肉鸽里每场战斗都要留下**本场统计快照**（回放底部「统计」页签的数据源）。
 *
 * 走真实 `runBattle`（不 mock）：一局只跑到第一场战斗结束，验证 stats 确实随回放一起带出来。
 */
describe('肉鸽战斗统计', () => {
    beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.5))
    afterEach(() => vi.restoreAllMocks())

    it('第一场战斗结束后 getBattleReplay() 带 level=2 的统计快照', () => {
        const run = new RogueliteRun()
        let replay = run.getBattleReplay('__none__')
        expect(replay).toBeUndefined()

        let state = run.getState()
        for (let i = 0; i < 60 && !replay; i++) {
            const round = state.rounds[state.rounds.length - 1]
            if (!round || round.choices.length === 0) break
            run.selectChoice(0)
            state = run.getState()
            // 战斗轮结算后本场回放（含统计）会挂到该轮 id 上
            for (const r of [...state.rounds, ...state.history]) {
                const got = run.getBattleReplay(r.id)
                if (got) {
                    replay = got
                    break
                }
            }
        }

        expect(replay).toBeDefined()
        expect(replay!.entries.length).toBeGreaterThan(0)
        expect(replay!.stats?.level).toBe(2)
        expect(replay!.stats?.battles).toBe(1)
        expect((replay!.stats?.chars.length ?? 0)).toBe(2)
    })
})

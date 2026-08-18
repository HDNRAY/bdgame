import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ════════════════════════════════════════
//  完整肉鸽流程集成测试
//  战斗用 mock 快速结算（真实 battle 模拟太慢），可控制玩家胜负：
//    battle.playerWins = true  → 玩家全胜
//    battle.playerWins = false → 玩家全败
//  覆盖：选出身 → 成长 → 守门人 → 小组赛 → 淘汰赛 → 夺冠 / 受伤 100 / 淘汰 → game over
// ════════════════════════════════════════

const battle = vi.hoisted(() => ({ playerWins: true }))

vi.mock('../../engine/battle-runner', () => ({
    runBattle: (_player: unknown, enemy: { id: string }) => ({
        winner: battle.playerWins ? 'player' : enemy.id,
        engine: { state: { log: { getAll: () => [] } } },
    }),
    simulateWinRate: () => ({ aWins: 1, bWins: 0 }),
}))

import { RogueliteRun } from '../roguelite/engine'
import type { GameState } from '../entities/state'
import type { TournamentData } from '../entities/tournament'
import { buildEmptyTournament, selectParticipants } from '../tournament/index'
import { processTournament, recordPlayerMatchResult, isTournamentEliminated } from '../tournament/integration'

/** 驱动一局直到结束（每个轮次选第一个选项）。 */
function driveToEnd(run: RogueliteRun): GameState {
    let state = run.getState()
    let guard = 0
    while (!state.finished && guard++ < 600) {
        const round = state.rounds[state.rounds.length - 1]
        if (!round || round.choices.length === 0) break
        run.selectChoice(0)
        state = run.getState()
    }
    return state
}

/** 构造一个空赛程（玩家必入赛）。 */
function makeTournament(): TournamentData {
    const players = selectParticipants({ includePlayer: true, playerId: 'player' })
    const { groupStage, knockoutStage } = buildEmptyTournament(players, 'player')
    return {
        name: '斗炁大会',
        phase: 'group_stage',
        playerId: 'player',
        participants: players,
        groupStage,
        knockoutStage,
    }
}

describe('完整肉鸽流程（战斗 mock，Math.random 固定保证确定性）', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5)
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('全胜 → 走完 33 节点 → 夺冠（冠军=玩家，正常结束非淘汰）', () => {
        battle.playerWins = true
        const run = new RogueliteRun()
        const state = driveToEnd(run)

        expect(state.finished).toBe(true)
        expect(state.injury).toBeLessThan(100)
        expect(state.nodeIndex).toBeGreaterThan(33) // 走完全部节点
        expect(state.tournamentData?.phase).toBe('finished')
        expect(state.tournamentData?.knockoutStage.championId).toBe('player')
    })

    it('全败 → 大会被淘汰 → game over（三阶段败场不再累积伤势，淘汰优先）', () => {
        battle.playerWins = false
        const run = new RogueliteRun()
        const state = driveToEnd(run)

        expect(state.finished).toBe(true)
        expect(state.nodeIndex).toBeLessThan(34)
        expect(state.tournamentData?.phase).not.toBe('finished') // 未夺冠
    })
})

/** 按真实节点顺序推进大会：open → 小组 r1/r2 → 出线 r3 → 十六强 → 八强 → 四强 → 决赛。
 *  winSchedule 依次对应每场战斗的胜负（共 7 场：小组 3 + 淘汰赛 3 + 决赛 1）。 */
function playTournament(winSchedule: boolean[]): { td: TournamentData; eliminated: boolean } {
    let td = makeTournament()
    const events = [
        'tournament_open',
        'tournament_group_r1',
        'tournament_group_r2',
        'tournament_group_r3',
        'tournament_knockout_16',
        'tournament_knockout_8',
        'tournament_knockout_4',
        'tournament_final',
    ]
    let idx = 0
    for (const ev of events) {
        const r = processTournament(td, ev)
        if (r.eliminated) return { td: r.tournamentData, eliminated: true }
        td = r.tournamentData
        if (ev !== 'tournament_group_r3' && r.opponentId !== undefined) {
            td = recordPlayerMatchResult(td, winSchedule[idx] ?? true)
            idx++
        }
    }
    return { td, eliminated: false }
}

describe('斗炁大会淘汰判定（纯函数，按真实节点顺序）', () => {
    it('小组赛三战全败 → 出线失败 → 淘汰', () => {
        const { eliminated } = playTournament([false, false, false])
        expect(eliminated).toBe(true)
    })

    it('小组赛全胜出线 → 十六强落败 → 八强判淘汰', () => {
        const { eliminated } = playTournament([true, true, true, false])
        expect(eliminated).toBe(true)
    })

    it('一路赢到决赛 → 决赛获胜 → 夺冠（不淘汰）', () => {
        const { td, eliminated } = playTournament([true, true, true, true, true, true, true])
        expect(eliminated).toBe(false)
        expect(td.phase).toBe('finished')
        expect(td.knockoutStage.championId).toBe('player')
        expect(isTournamentEliminated(td)).toBe(false)
    })

    it('一路赢到决赛 → 决赛落败 → 淘汰', () => {
        const { td, eliminated } = playTournament([true, true, true, true, true, true, false])
        expect(eliminated).toBe(false) // 决赛在战斗结算后判定
        expect(td.phase).toBe('finished')
        expect(td.knockoutStage.championId).not.toBe('player')
        expect(isTournamentEliminated(td)).toBe(true)
    })
})

import { describe, it, expect } from 'vitest'
import { diffRunEvents } from '../roguelite-analytics'
import type { AnalyticsCall } from '../roguelite-analytics'
import type { GameState } from '../../../game/entities/state'
import type { Round } from '../../../game/entities/round'
import type { CharacterBuild } from '../../../game/entities/character-build'

/**
 * `diffRunEvents` 的判定。这里只喂手写的 `GameState` 字面量（纯函数，不需要引擎、不联网），
 * 覆盖：普通选择不发任何事件、故事线一次性、战斗参数、结局优先级、同快照事件顺序。
 */

function mkBuild(story = ''): CharacterBuild {
    return {
        id: 'player',
        name: '无名',
        story,
        battleStyle: 'melee',
        baseAttrs: { strength: 10 },
        weapon: 'wood_sword',
        rewards: [{ type: 'weapon', id: 'wood_sword', name: '桃木剑', description: '', tags: [] }],
    }
}

function mkState(over: Partial<GameState> = {}): GameState {
    return {
        nodeIndex: 1,
        roundIdx: 0,
        nodes: [],
        rounds: [],
        history: [],
        build: mkBuild(),
        unspentPoints: 0,
        injury: 0,
        flags: {},
        nodeLog: [],
        finished: false,
        ...over,
    }
}

/** 一轮已结算的战斗（引擎在 selectChoice 里结算并 push 进 rounds） */
function mkBattleRound(over: Partial<Round> = {}): Round {
    return {
        id: 'foe',
        title: '遭遇',
        choices: [],
        result: { won: true, injuryGained: 0 },
        ...over,
    }
}

function names(calls: AnalyticsCall[]): string[] {
    return calls.map((c) => c.event)
}

describe('diffRunEvents', () => {
    it('普通选择（已选过线、未跨章、无战斗）不产生任何事件', () => {
        const prev = mkState({ nodeIndex: 5, build: mkBuild('feud') })
        const next = mkState({ nodeIndex: 5, build: mkBuild('feud') })
        expect(diffRunEvents(prev, next)).toEqual([])
    })

    it('写 build.story 的那一次产生 story_pick，且只产生一次', () => {
        const prev = mkState({ nodeIndex: 1 })
        const picked = mkState({ nodeIndex: 1, build: mkBuild('xuanmen') })
        const calls = diffRunEvents(prev, picked)
        expect(calls).toEqual([{ event: 'story_pick', data: { story: 'xuanmen' } }])

        // 再往后推进时 story 已经非空，不会重复发
        const later = mkState({ nodeIndex: 2, build: mkBuild('xuanmen') })
        expect(diffRunEvents(picked, later)).toEqual([])
    })

    it('runBattles.total +1 产生 battle_end：胜、伤势、node 都对', () => {
        const prev = mkState({ nodeIndex: 4, runBattles: { total: 2, wins: 1, losses: 1 } })
        const round = mkBattleRound({ result: { won: false, injuryGained: 7 } })
        const next = mkState({
            nodeIndex: 4,
            rounds: [round],
            injury: 7,
            runBattles: { total: 3, wins: 1, losses: 2 },
        })
        expect(diffRunEvents(prev, next)).toEqual([
            {
                event: 'battle_end',
                data: { node: 4, won: false, champion_boss: false, tournament: false, injury: 7 },
            },
        ])
    })

    it('隐藏boss（round.enemyBuild）标 champion_boss；大会正式场次标 tournament', () => {
        const prev = mkState({ nodeIndex: 33, runBattles: { total: 5, wins: 5, losses: 0 } })
        const next = mkState({
            nodeIndex: 33,
            rounds: [mkBattleRound({ id: 'boss', enemyBuild: mkBuild('feud') })],
            runBattles: { total: 6, wins: 6, losses: 0 },
        })
        const calls = diffRunEvents(prev, next)
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ event: 'battle_end', data: { champion_boss: true, tournament: false } })

        // 大会：tournamentData 存在且 round.id 是正式场次
        const prevT = mkState({ nodeIndex: 24, runBattles: { total: 1, wins: 1, losses: 0 } })
        const nextT = mkState({
            nodeIndex: 24,
            rounds: [mkBattleRound({ id: 'match' })],
            runBattles: { total: 2, wins: 2, losses: 0 },
            tournamentData: {} as GameState['tournamentData'],
        })
        expect(diffRunEvents(prevT, nextT)[0]).toMatchObject({
            event: 'battle_end',
            data: { champion_boss: false, tournament: true },
        })

        // n23 热身赛（id='warmup'）不算正式场次
        const nextW = mkState({
            nodeIndex: 24,
            rounds: [mkBattleRound({ id: 'warmup' })],
            runBattles: { total: 2, wins: 2, losses: 0 },
            tournamentData: {} as GameState['tournamentData'],
        })
        expect(diffRunEvents(prevT, nextW)[0]).toMatchObject({ event: 'battle_end', data: { tournament: false } })
    })

    it('教学观战轮（tutorial）不计入，即使快照里有 result 也不发 battle_end', () => {
        const prev = mkState({ nodeIndex: 3, runBattles: { total: 1, wins: 1, losses: 0 } })
        const next = mkState({
            nodeIndex: 3,
            rounds: [mkBattleRound({ tutorial: { aId: 'a', bId: 'b' } })],
            runBattles: { total: 1, wins: 1, losses: 0 },
        })
        expect(diffRunEvents(prev, next)).toEqual([])
    })

    it('finished false → true 产生 run_end：outcome 按 flags 优先级（true > fallen > loop > 默认）', () => {
        const prev = mkState({ nodeIndex: 33, runBattles: { total: 16, wins: 15, losses: 1 }, injury: 40 })
        const base = {
            nodeIndex: 34,
            finished: true,
            injury: 40,
            runBattles: { total: 16, wins: 15, losses: 1 },
        }
        const cases: [Record<string, boolean>, string][] = [
            [{ ending_true: true, ending_fallen: true, ending_loop: true }, 'true'],
            [{ ending_fallen: true, ending_loop: true }, 'fallen'],
            [{ ending_loop: true }, 'loop'],
            [{}, 'eliminated'],
        ]
        for (const [flags, outcome] of cases) {
            const calls = diffRunEvents(prev, mkState({ ...base, flags }))
            expect(calls).toEqual([
                {
                    event: 'run_end',
                    data: {
                        outcome,
                        node: 33,
                        battles: 16,
                        wins: 15,
                        losses: 1,
                        injuries: 40,
                        rewards: 1,
                    },
                },
            ])
        }
    })

    it('run_end.node 取上一份快照的 nodeIndex（结局那一步引擎先自增到 34）', () => {
        const prev = mkState({ nodeIndex: 22, finished: false })
        const next = mkState({ nodeIndex: 34, finished: true })
        const calls = diffRunEvents(prev, next)
        expect(calls[0]).toMatchObject({ event: 'run_end', data: { node: 22 } })
    })

    it('同一次快照里"战斗 + 结束"按 battle_end → run_end 顺序输出', () => {
        const prev = mkState({ nodeIndex: 33, runBattles: { total: 15, wins: 14, losses: 1 } })
        const next = mkState({
            nodeIndex: 34,
            finished: true,
            rounds: [mkBattleRound({ result: { won: false, injuryGained: 0 } })],
            runBattles: { total: 16, wins: 14, losses: 2 },
            tournamentData: {} as GameState['tournamentData'],
        })
        expect(names(diffRunEvents(prev, next))).toEqual(['battle_end', 'run_end'])
    })

    it('一局没有战斗时 runBattles 缺省按 0 计（教学开局直接弃局/结束不报错）', () => {
        const prev = mkState({ nodeIndex: 1 })
        const next = mkState({ nodeIndex: 2, finished: true })
        expect(diffRunEvents(prev, next)).toEqual([
            {
                event: 'run_end',
                data: {
                    outcome: 'eliminated',
                    node: 1,
                    battles: 0,
                    wins: 0,
                    losses: 0,
                    injuries: 0,
                    rewards: 1,
                },
            },
        ])
    })

    it('battle_end 找不到对应战斗轮时不硬编参数（宁可不发）', () => {
        const prev = mkState({ nodeIndex: 5, runBattles: { total: 1, wins: 1, losses: 0 } })
        // runBattles 涨了但 rounds/history 里没有已结算的战斗轮（异常快照）
        const next = mkState({ nodeIndex: 5, runBattles: { total: 2, wins: 2, losses: 0 } })
        expect(diffRunEvents(prev, next)).toEqual([])
    })
})

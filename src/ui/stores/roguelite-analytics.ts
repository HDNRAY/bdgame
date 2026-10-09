import type { GameState } from '../../game/entities/state'
import type { Round } from '../../game/entities/round'
import type { AnalyticsEvent, AnalyticsEventMap } from '../../bridge/analytics'

/**
 * 引擎状态 → 埋点事件的**纯函数**差分（计划 `docs/analytics-plan.md` 第 4.2 节）。
 *
 * 只有「引擎 `_emit()` 推过来的两次快照」能算的事件放这里；`run_start`（store 的 `set`，
 * 不经过引擎）与 `run_abandon`（UI 主动退出）由调用点显式发。
 *
 * `prev` 是上一次**非结束**快照里的 `nodeIndex`（见 store）：结局那一步 `_advanceToNextNode`
 * 先自增到 34 再判结束，直接读 `next.nodeIndex` 会拿到 34，不是玩家真正死在哪一节点。
 */

/** 一条待发送的事件（事件名与参数形状受 `AnalyticsEventMap` 约束） */
export type AnalyticsCall = {
    [K in AnalyticsEvent]: { event: K; data: AnalyticsEventMap[K] }
}[AnalyticsEvent]

/** 结局判定：与 `src/ui/components/roguelite/ending-title.ts` 的旗标优先级一致（true > fallen > loop > 默认） */
function outcomeOf(state: GameState): AnalyticsEventMap['run_end']['outcome'] {
    if (state.flags['ending_true']) return 'true'
    if (state.flags['ending_fallen']) return 'fallen'
    if (state.flags['ending_loop']) return 'loop'
    // 两类「没走到结局」：伤势满 100 中途结束、斗炁大会被淘汰（都不写 ending_* flag）
    return 'eliminated'
}

/** 斗炁大会的正式场次（n23 热身赛 id 不是这两个，不计胜负） */
function isTournamentMatch(round: Round, state: GameState): boolean {
    return !!state.tournamentData && (round.id === 'match' || round.id === 'group_r0')
}

/** 最近一轮的已结算战斗（战斗、教学都不算） */
function lastBattleRound(rounds: Round[]): Round | undefined {
    for (let i = rounds.length - 1; i >= 0; i--) {
        const r = rounds[i]
        if (!r.tutorial && r.result) return r
    }
    return undefined
}

/**
 * 算这次快照差分要发的事件。
 * 顺序固定：`story_pick` → `battle_end` → `run_end`（同一次 emit 里战斗与结束同时发生时，
 * 先战斗后结局）。
 */
export function diffRunEvents(prev: GameState, next: GameState): AnalyticsCall[] {
    const calls: AnalyticsCall[] = []

    if (!prev.build.story && next.build.story) {
        calls.push({ event: 'story_pick', data: { story: next.build.story } })
    }

    const prevTotal = prev.runBattles?.total ?? 0
    const nextBattles = next.runBattles
    if (nextBattles && nextBattles.total > prevTotal) {
        const round = lastBattleRound(next.rounds) ?? lastBattleRound(next.history)
        if (round?.result) {
            calls.push({
                event: 'battle_end',
                data: {
                    node: next.nodeIndex,
                    won: round.result.won,
                    // 隐藏boss：这一轮的敌人来自存档里的玩家 build（不走 gen()）
                    champion_boss: !!round.enemyBuild,
                    tournament: isTournamentMatch(round, next),
                    injury: round.result.injuryGained,
                },
            })
        }
    }

    if (!prev.finished && next.finished) {
        calls.push({
            event: 'run_end',
            data: {
                outcome: outcomeOf(next),
                node: prev.nodeIndex,
                battles: nextBattles?.total ?? 0,
                wins: nextBattles?.wins ?? 0,
                losses: nextBattles?.losses ?? 0,
                injuries: next.injury,
                // 只发数量，不发奖励清单
                rewards: next.build.rewards.length,
            },
        })
    }

    return calls
}

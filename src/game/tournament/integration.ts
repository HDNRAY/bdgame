// ════════════════════════════════════════
//  integration — 斗炁大会纯函数
//  输入 tournamentData + eventId，输出更新后数据 + 对手ID + 淘汰状态。
//  不依赖 GameState，不写 flags。
//
//  节点 → 轮次映射（玩家的战斗发生在「进入该节点」时）：
//    n23 tournament_open          : 小组赛 r0（不推进）
//    n26 tournament_group_r1      : 小组赛 r1（推进 r0）
//    n27 tournament_group_r2      : 小组赛 r2（推进 r1）
//    n28 tournament_group_r3      : 出线结算（推进 r2 → 定 16 强），无战斗
//    n29 tournament_knockout_16   : 十六强（不推进，对阵已在出线时定好）
//    n30 tournament_knockout_8    : 八强（推进十六强）
//    n31 tournament_knockout_4    : 四强（推进八强）
//    n33 tournament_final         : 决赛（推进四强；打完后定冠军）
// ════════════════════════════════════════

import type { TournamentData } from '../entities/tournament'
import { buildEmptyTournament, finalizeGroupStage } from './bracket-builder'
import { simulateGroupRound, simulateKnockoutRound } from './simulator'
import { selectParticipants } from './participants'
import { KNOCKOUT_ROUNDS } from '../entities/tournament'

// ── 导出类型 ──

export interface TournamentResult {
    tournamentData: TournamentData
    opponentId?: string
    eliminated: boolean
}

/** 斗炁大会事件 ID 集合 */
export const TOURNAMENT_EVENT_IDS = new Set([
    'tournament_open',
    'tournament_group_r1',
    'tournament_group_r2',
    'tournament_group_r3',
    'tournament_knockout_16',
    'tournament_knockout_8',
    'tournament_knockout_4',
    'tournament_final',
])

// ── 主入口 ──

/**
 * 处理一轮斗炁大会事件。
 *
 * @param tournamentData - 当前赛程数据。undefined 时自动初始化（仅限 tournament_open）。
 * @param eventId        - 当前节点的 eventId。
 * @param finalBossId    - 故事线指定的决赛 Boss ID（引擎从 flags 读取后传入）。
 */
export function processTournament(
    tournamentData: TournamentData | undefined,
    eventId: string,
    finalBossId?: string,
): TournamentResult {
    const td = tournamentData ?? createInitialTournament(finalBossId)
    let eliminated = false

    switch (eventId) {
        case 'tournament_open':
        case 'tournament_knockout_16':
            // 直接打当前轮：小组 r0 / 十六强（对阵已在出线时定好）
            break
        case 'tournament_group_r1':
        case 'tournament_group_r2':
        case 'tournament_group_r3':
            advanceGroup(td)
            break
        case 'tournament_knockout_8':
        case 'tournament_knockout_4':
        case 'tournament_final':
            advanceKnockout(td)
            break
    }

    // 淘汰检测
    const pid = td.playerId
    if (pid) {
        if (eventId === 'tournament_group_r3' && td.phase === 'knockout') {
            // 出线判定：16 强名单里没有玩家 → 淘汰
            if (!td.groupStage.qualifiers.includes(pid)) eliminated = true
        } else if (td.phase === 'knockout' && !td.knockoutStage.finished) {
            // 淘汰赛进行中：当前轮没有玩家的比赛 → 上一轮已输 → 淘汰
            const round = td.knockoutStage.currentRound
            const hasMatch = (td.knockoutStage.rounds[round]?.matches ?? []).some((m) =>
                (m.match?.participantIds ?? m.participantIds).includes(pid),
            )
            if (!hasMatch) eliminated = true
        } else if (td.phase === 'finished') {
            // 大会已结束：冠军不是玩家 → 淘汰
            if (td.knockoutStage.championId !== pid) eliminated = true
        }
    }

    // 出线节点（group_r3）不打：十六强留到下一节点
    const opponentId = eventId === 'tournament_group_r3' ? undefined : findPlayerOpponent(td) ?? undefined
    return { tournamentData: td, opponentId, eliminated }
}

/**
 * 把玩家一场真实战斗的结果写回赛程。
 * 找到玩家当前轮次的待定比赛（winnerId 为空），填入胜负。
 * 若该场是决赛（最后一轮），同时定出冠军并结束大会。
 */
export function recordPlayerMatchResult(tournamentData: TournamentData, won: boolean): TournamentData {
    const t = structuredClone(tournamentData)
    const pid = t.playerId
    if (!pid) return t

    if (t.phase === 'group_stage') {
        for (const group of t.groupStage.groups) {
            for (const m of group.matches) {
                if (!m.isPlayerMatch || m.winnerId !== null) continue
                const [a, b] = m.participantIds
                if (!a || !b) continue
                const opp = a === pid ? b : a
                m.winnerId = won ? pid : opp
                m.loserId = won ? opp : pid
                m.scores = won ? [1, 0] : [0, 1]
                return t
            }
        }
        return t
    }

    // 淘汰赛 / 决赛：当前轮的玩家比赛
    const round = Math.min(t.knockoutStage.currentRound, KNOCKOUT_ROUNDS - 1)
    const matches = t.knockoutStage.rounds[round]?.matches ?? []
    for (const km of matches) {
        const ids = km.match?.participantIds ?? km.participantIds
        if (!ids.includes(pid)) continue
        if (km.match && km.match.winnerId !== null) continue
        if (!km.match) {
            km.match = {
                participantIds: ids as [string, string],
                winnerId: null,
                loserId: null,
                scores: [0, 0] as [number, number],
                bestOf: 3,
                isPlayerMatch: true,
            }
        }
        const [a, b] = km.match.participantIds
        if (!a || !b) continue
        const opp = a === pid ? b : a
        km.match.winnerId = won ? pid : opp
        km.match.loserId = won ? opp : pid
        km.match.scores = won ? [1, 0] : [0, 1]
        // 决赛打完 → 定冠军、结束大会
        if (round === KNOCKOUT_ROUNDS - 1) {
            t.knockoutStage.finished = true
            t.knockoutStage.championId = won ? pid : opp
            t.phase = 'finished'
        }
        return t
    }
    return t
}

/** 大会是否已因玩家落败而终结（冠军不是玩家）。 */
export function isTournamentEliminated(tournamentData: TournamentData): boolean {
    const pid = tournamentData.playerId
    if (!pid) return false
    return tournamentData.phase === 'finished' && tournamentData.knockoutStage.championId !== pid
}

// ── 内部 ──

function createInitialTournament(finalBossId?: string): TournamentData {
    const seeds = finalBossId ? { [finalBossId]: 9998 } : undefined
    const players = selectParticipants({ includePlayer: true, playerId: 'player', seeds })
    const { groupStage, knockoutStage } = buildEmptyTournament(players, 'player')
    return {
        name: '斗炁大会',
        phase: 'group_stage',
        playerId: 'player',
        participants: players,
        groupStage,
        knockoutStage,
        finalBossId,
    }
}

function advanceGroup(td: TournamentData): void {
    if (td.phase !== 'group_stage' || td.groupStage.currentRound >= 3) return
    const u = simulateGroupRound(structuredClone(td))
    Object.assign(td, u)
}

function advanceKnockout(td: TournamentData): void {
    if (td.phase === 'group_stage') {
        const { qualifiers, knockoutStage } = finalizeGroupStage(td.groupStage.groups, td.playerId)
        td.groupStage.qualifiers = qualifiers
        td.groupStage.finished = true
        td.knockoutStage = knockoutStage
        td.phase = 'knockout'
    }
    if (td.phase !== 'knockout' || td.knockoutStage.finished) return
    const u = simulateKnockoutRound(structuredClone(td))
    Object.assign(td, u)
}

function findPlayerOpponent(td: TournamentData): string | null {
    if (!td.playerId) return null
    const pid = td.playerId

    if (td.phase === 'group_stage') {
        for (const g of td.groupStage.groups) {
            if (!g.participantIds.includes(pid)) continue
            for (const m of g.matches) {
                if (m.isPlayerMatch && m.winnerId === null) {
                    return m.participantIds.find((id) => id !== pid) ?? null
                }
            }
        }
    }

    if (td.phase === 'knockout' || td.phase === 'finished') {
        for (const r of td.knockoutStage.rounds) {
            for (const m of r.matches) {
                const ids = m.match?.participantIds ?? m.participantIds
                if (!ids.includes(pid)) continue
                if (m.match === null || m.match.winnerId === null) {
                    return ids.find((id) => id !== pid) ?? null
                }
            }
        }
    }

    return null
}

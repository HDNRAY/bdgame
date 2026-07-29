// ════════════════════════════════════════
//  integration — 斗炁大会纯函数
//  输入 tournamentData + eventId，输出更新后数据 + 对手ID + 淘汰状态。
//  不依赖 GameState，不写 flags。
// ════════════════════════════════════════

import type { TournamentData } from '../entities/tournament'
import { buildEmptyTournament, finalizeGroupStage } from './bracket-builder'
import { simulateGroupRound, simulateKnockoutRound } from './simulator'
import { selectParticipants } from './participants'

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
            break
        case 'tournament_group_r1':
        case 'tournament_group_r2':
        case 'tournament_group_r3':
            advanceGroup(td)
            break
        case 'tournament_knockout_16':
        case 'tournament_knockout_8':
        case 'tournament_knockout_4':
            advanceKnockout(td)
            break
        case 'tournament_final':
            break
    }

    if (td.phase === 'finished' && td.playerId) {
        if (td.knockoutStage.championId !== td.playerId) {
            eliminated = true
        }
    }

    const opponentId = findPlayerOpponent(td) ?? undefined
    return { tournamentData: td, opponentId, eliminated }
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

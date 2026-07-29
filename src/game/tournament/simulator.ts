// ════════════════════════════════════════
//  simulator — 比赛模拟
//  依赖 engine/battle-runner.ts 的 simulateWinRate
//  每次只推进一轮（不出循环全算完）。
// ════════════════════════════════════════

import type { TournamentData, TournamentParticipant, MatchResult, KnockoutRound } from '../entities/tournament'
import { GROUP_MAX_ROUNDS, KNOCKOUT_ROUNDS } from '../entities/tournament'
import { getGroupRoundMatches, calculateGroupStandings, finalizeGroupStage } from './bracket-builder'
import { gen, getOpponentDef } from '../../data/opponents/index'
import { simulateWinRate } from '../../engine/battle-runner'

// ────────────────────────────────────────
//  单场模拟
// ────────────────────────────────────────

/**
 * 模拟一场 NPC 之间的比赛。
 * @param participantA - 参赛者 A
 * @param participantB - 参赛者 B
 * @param bestOf - 几局几胜（1=BO1, 3=BO3）
 * @returns MatchResult
 */
export function simulateSingleMatch(
    participantA: TournamentParticipant,
    participantB: TournamentParticipant,
    bestOf: number,
): MatchResult {
    const defA = getOpponentDef(participantA.id)
    const defB = getOpponentDef(participantB.id)

    if (!defA || !defB) {
        throw new Error(`找不到对手定义: ${!defA ? participantA.id : participantB.id}`)
    }

    const buildA = gen(defA, participantA.level)
    const buildB = gen(defB, participantB.level)

    const { aWins, bWins } = simulateWinRate(buildA, buildB, bestOf)

    let winnerId: string | null
    let loserId: string | null

    if (aWins > bWins) {
        winnerId = participantA.id
        loserId = participantB.id
    } else if (bWins > aWins) {
        winnerId = participantB.id
        loserId = participantA.id
    } else {
        // 平局：按 HP 百分比决定（simulateWinRate 不返回 hpPct，
        // 直接 winnerId=null 表示平局）
        winnerId = null
        loserId = null
    }

    return {
        participantIds: [participantA.id, participantB.id],
        winnerId,
        loserId,
        scores: [aWins, bWins],
        bestOf,
        isPlayerMatch: false,
    }
}

// ────────────────────────────────────────
//  小组赛：推进一轮
// ────────────────────────────────────────

/**
 * 推进一轮小组赛。
 * 只模拟当前 currentRound 中所有非玩家比赛。
 * 玩家比赛维持 winnerId=null，留给玩家手动打。
 *
 * @returns 新的 TournamentData（不修改原对象）
 */
export function simulateGroupRound(tournament: TournamentData): TournamentData {
    const t = structuredClone(tournament)
    const { groupStage } = t
    const round = groupStage.currentRound

    if (round >= GROUP_MAX_ROUNDS) {
        throw new Error(`小组赛已打完（round=${round}），无法再推进`)
    }

    const participantsMap = new Map(t.participants.map((p) => [p.id, p]))

    for (const group of groupStage.groups) {
        const matchIndices = getGroupRoundMatches(group, round)
        for (const mi of matchIndices) {
            const match = group.matches[mi]
            if (match.winnerId !== null) continue // 已有结果
            if (match.isPlayerMatch) continue // 玩家比赛，跳过

            const a = participantsMap.get(match.participantIds[0])
            const b = participantsMap.get(match.participantIds[1])
            if (!a || !b) continue

            const result = simulateSingleMatch(a, b, match.bestOf)
            // 更新 match
            match.winnerId = result.winnerId
            match.loserId = result.loserId
            match.scores = result.scores

            // 强制决赛 Boss 获胜（非玩家比赛）
            forceBossWin(match, t.finalBossId, t.playerId)
        }
    }

    // 推进轮次
    groupStage.currentRound++

    // 更新积分榜
    groupStage.standings = calculateGroupStandings(groupStage.groups)

    // 如果所有轮次打完，进入淘汰赛
    if (groupStage.currentRound >= GROUP_MAX_ROUNDS) {
        groupStage.finished = true

        // 生成出线名单和淘汰赛 bracket
        const { qualifiers, knockoutStage } = finalizeGroupStage(groupStage.groups, t.playerId)
        groupStage.qualifiers = qualifiers
        t.knockoutStage = knockoutStage
        t.phase = 'knockout'
    }

    return t
}

// ────────────────────────────────────────
//  淘汰赛：推进一轮
// ────────────────────────────────────────

/**
 * 推进一轮淘汰赛。
 * 只模拟当前 currentRound 中所有非玩家比赛。
 * 玩家比赛维持 null，留给玩家手动打。
 *
 * @returns 新的 TournamentData（不修改原对象）
 */
export function simulateKnockoutRound(tournament: TournamentData): TournamentData {
    const t = structuredClone(tournament)
    const { knockoutStage } = t
    const round = knockoutStage.currentRound

    if (round >= KNOCKOUT_ROUNDS) {
        throw new Error(`淘汰赛已打完（round=${round}），无法再推进`)
    }

    const currentRoundData = knockoutStage.rounds[round]
    const participantsMap = new Map(t.participants.map((p) => [p.id, p]))

    for (const match of currentRoundData.matches) {
        // 跳过已打完的
        if (match.match?.winnerId !== null && match.match?.winnerId !== undefined) continue

        const [aId, bId] = match.participantIds
        if (!aId || !bId) {
            // 参赛者未定（上一轮结果未出），跳过
            continue
        }

        // 如果已有 match 对象且是玩家比赛，跳过
        if (match.match?.isPlayerMatch) continue

        const a = participantsMap.get(aId)
        const b = participantsMap.get(bId)
        if (!a || !b) continue

        const result = simulateSingleMatch(a, b, 3)

        // 更新或创建 match
        match.match = result

        // 强制决赛 Boss 获胜（非玩家比赛）
        if (match.match && !match.match.isPlayerMatch) {
            forceBossWin(match.match, t.finalBossId, t.playerId)
        }
    }

    // 推进轮次
    knockoutStage.currentRound++

    // 填充下一轮的参赛者
    if (round + 1 < KNOCKOUT_ROUNDS) {
        fillNextRoundParticipants(knockoutStage.rounds, round)
    }

    // 判断是否全部打完
    if (knockoutStage.currentRound >= KNOCKOUT_ROUNDS) {
        knockoutStage.finished = true
        t.phase = 'finished'

        // 取决赛胜者
        const finalMatch = knockoutStage.rounds[KNOCKOUT_ROUNDS - 1].matches[0]
        knockoutStage.championId = finalMatch.match?.winnerId ?? null
    }

    return t
}

/**
 * 将当前轮次的胜者填入下一轮的对应位置。
 */
function fillNextRoundParticipants(rounds: KnockoutRound[], currentRound: number): void {
    const current = rounds[currentRound]
    const next = rounds[currentRound + 1]

    for (const match of current.matches) {
        if (!match.match?.winnerId) continue
        const targetSlot = Math.floor(match.slotIndex / 2)
        const isFirst = match.slotIndex % 2 === 0
        if (isFirst) {
            next.matches[targetSlot].participantIds[0] = match.match.winnerId
        } else {
            next.matches[targetSlot].participantIds[1] = match.match.winnerId
        }
    }
}

/**
 * 如果指定了决赛 Boss，且本场比赛涉及 Boss（对手不是玩家），强制 Boss 获胜。
 * 在 simulateSingleMatch 之后调用，覆盖真实模拟结果。
 */
export function forceBossWin(match: MatchResult, finalBossId: string | undefined, playerId: string | null): void {
    if (!finalBossId) return
    if (match.isPlayerMatch) return
    if (match.participantIds.includes(playerId ?? '')) return

    if (match.winnerId === finalBossId) return // 已经赢了，不需要改

    const bossIdx = match.participantIds.indexOf(finalBossId)
    if (bossIdx === -1) return // 本场没 Boss

    const opponentId = match.participantIds[1 - bossIdx]
    match.winnerId = finalBossId
    match.loserId = opponentId
    match.scores = bossIdx === 0 ? ([1, 0] as [number, number]) : ([0, 1] as [number, number])
}

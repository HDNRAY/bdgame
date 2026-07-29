// ════════════════════════════════════════
//  bracket-builder — 建小组赛分组 & 淘汰赛 Bracket
//  纯函数，不涉及战斗模拟。
// ════════════════════════════════════════

import type {
    TournamentParticipant,
    GroupInfo,
    MatchResult,
    KnockoutRound,
    KnockoutMatch,
    GroupStageData,
    KnockoutStageData,
    GroupStandingEntry,
} from '../entities/tournament'
import {
    GROUP_COUNT,
    GROUP_MIN_SIZE,
    KNOCKOUT_ROUNDS,
    KNOCKOUT_PARTICIPANTS,
    ROUND_LABELS,
} from '../entities/tournament'

// ────────────────────────────────────────
//  小组赛
// ────────────────────────────────────────

/**
 * 将参赛者分配到 8 个小组。
 * 32 人 → 8 组 × 4 人
 * 31 人 → 7 组 × 4 人 + 1 组 × 3 人
 * 自动按 seed 蛇形分配以平衡实力。
 */
export function buildGroupStage(participants: TournamentParticipant[]): GroupInfo[] {
    const sorted = [...participants].sort((a, b) => (b.seed ?? 0) - (a.seed ?? 0))
    const groups: GroupInfo[] = []

    // 计算每组人数：尽可能均匀
    const total = sorted.length
    const baseSize = Math.floor(total / GROUP_COUNT)
    const extra = total - baseSize * GROUP_COUNT
    const sizes: number[] = []
    for (let i = 0; i < GROUP_COUNT; i++) {
        sizes.push(baseSize + (i < extra ? 1 : 0))
    }

    // 蛇形分配（1st → A, 2nd → B, …, 9th → H, 10th → G, …）
    let idx = 0
    for (let g = 0; g < GROUP_COUNT; g++) {
        const size = sizes[g]
        if (size < GROUP_MIN_SIZE) {
            groups.push({
                name: String.fromCharCode(65 + g),
                participantIds: [],
                matches: [],
            })
            continue
        }
        const ids: string[] = []
        for (let i = 0; i < size; i++) {
            ids.push(sorted[idx].id)
            idx++
        }
        // 组内按 seed 排序以保持一致性
        ids.sort((a, b) => {
            const sa = participants.find((p) => p.id === a)?.seed ?? 0
            const sb = participants.find((p) => p.id === b)?.seed ?? 0
            return sb - sa
        })
        groups.push({
            name: String.fromCharCode(65 + g),
            participantIds: ids,
            matches: [],
        })
    }

    // 生成每组的循环赛赛程
    for (const group of groups) {
        if (group.participantIds.length < GROUP_MIN_SIZE) continue
        group.matches = buildGroupMatches(group.participantIds)
    }

    return groups
}

/**
 * 生成组内循环赛对阵。
 *
 * Round-robin 固定赛程（保证每轮每个选手恰好一场）：
 *   n=4: 轮0 [0-1,2-3], 轮1 [0-2,1-3], 轮2 [0-3,1-2]
 *   n=3: 轮0 [0-1],      轮1 [0-2],      轮2 [1-2]
 */
export function buildGroupMatches(participantIds: string[]): MatchResult[] {
    const n = participantIds.length
    const matches: MatchResult[] = []

    if (n === 4) {
        // 固定循环赛程
        const schedule: [number, number][] = [
            [0, 1],
            [2, 3],
            [0, 2],
            [1, 3],
            [0, 3],
            [1, 2],
        ]
        for (const [a, b] of schedule) {
            matches.push(createEmptyMatch(participantIds[a], participantIds[b], 1))
        }
    } else if (n === 3) {
        const schedule: [number, number][] = [
            [0, 1],
            [0, 2],
            [1, 2],
        ]
        for (const [a, b] of schedule) {
            matches.push(createEmptyMatch(participantIds[a], participantIds[b], 1))
        }
    }

    return matches
}

/**
 * 获取某组某一轮的全部比赛索引。
 * 组内 matches[] 按顺序排列，每轮固定 2 场（4人组）或 1 场（3人组）。
 */
export function getGroupRoundMatches(group: GroupInfo, round: number): number[] {
    const n = group.participantIds.length
    if (n === 4) {
        const idx = round * 2
        if (idx + 1 >= group.matches.length) return []
        return [idx, idx + 1]
    } else if (n === 3) {
        return round < group.matches.length ? [round] : []
    }
    return []
}

/** 创建一场空比赛结果 */
function createEmptyMatch(aId: string, bId: string, bestOf: number): MatchResult {
    return {
        participantIds: [aId, bId],
        winnerId: null,
        loserId: null,
        scores: [0, 0],
        bestOf,
        isPlayerMatch: false,
    }
}

// ────────────────────────────────────────
//  淘汰赛 Bracket
// ────────────────────────────────────────

/**
 * 由 16 强出线名单构建淘汰赛 bracket。
 *
 * 配对规则：小组第一 vs 另一组第二（交叉配对避免同组决赛）：
 *   上半区: A1 vs B2, C1 vs D2, E1 vs F2, G1 vs H2
 *   下半区: B1 vs A2, D1 vs C2, F1 vs E2, H1 vs G2
 */
export function buildKnockoutBracket(qualifierIds: string[], groups: GroupInfo[]): KnockoutRound[] {
    if (qualifierIds.length !== KNOCKOUT_PARTICIPANTS) {
        throw new Error(`需要 ${KNOCKOUT_PARTICIPANTS} 人晋级，当前 ${qualifierIds.length} 人`)
    }

    // 构建小组排名映射：{ groupName: [firstId, secondId] }
    const groupRanking = new Map<string, [string, string]>()
    const standings = calculateGroupStandings(groups)
    for (let i = 0; i < standings.length; i++) {
        const group = groups[i]
        const entries = standings[i]
        if (entries.length >= 2) {
            groupRanking.set(group.name, [entries[0].participantId, entries[1].participantId])
        }
    }

    // 交叉配对
    const pairings: [string, string][] = [
        [getQualifier('A', 0), getQualifier('B', 1)],
        [getQualifier('C', 0), getQualifier('D', 1)],
        [getQualifier('E', 0), getQualifier('F', 1)],
        [getQualifier('G', 0), getQualifier('H', 1)],
        [getQualifier('B', 0), getQualifier('A', 1)],
        [getQualifier('D', 0), getQualifier('C', 1)],
        [getQualifier('F', 0), getQualifier('E', 1)],
        [getQualifier('H', 0), getQualifier('G', 1)],
    ]

    const rounds: KnockoutRound[] = []

    // 十六强（round 0）
    const round16 = pairings.map(([a, b], i) => ({
        round: 0,
        slotIndex: i,
        participantIds: [a, b] as [string, string],
        match: null,
    }))
    rounds.push({ round: 0, label: ROUND_LABELS[0], matches: round16 })

    // 后续轮次（八强→四强→决赛）
    for (let r = 1; r < KNOCKOUT_ROUNDS; r++) {
        const prevCount = rounds[r - 1].matches.length
        const matchCount = prevCount / 2
        const matches: KnockoutMatch[] = []
        for (let i = 0; i < matchCount; i++) {
            matches.push({
                round: r,
                slotIndex: i,
                participantIds: [null, null],
                match: null,
            })
        }
        rounds.push({ round: r, label: ROUND_LABELS[r], matches })
    }

    return rounds

    function getQualifier(groupName: string, rank: 0 | 1): string {
        const pair = groupRanking.get(groupName)
        if (!pair) throw new Error(`小组 ${groupName} 无出线者`)
        return pair[rank]
    }
}

// ────────────────────────────────────────
//  积分榜
// ────────────────────────────────────────

/**
 * 计算所有小组的积分榜。
 * 按胜场排序，同胜场按胜负关系（head-to-head）tiebreak。
 */
export function calculateGroupStandings(groups: GroupInfo[]): GroupStandingEntry[][] {
    return groups.map((group) => {
        const entries = new Map<string, GroupStandingEntry>()

        // 初始化
        for (const id of group.participantIds) {
            entries.set(id, {
                participantId: id,
                wins: 0,
                losses: 0,
                headToHead: {},
            })
        }

        // 统计
        for (const match of group.matches) {
            const [a, b] = match.participantIds
            const entryA = entries.get(a)
            const entryB = entries.get(b)
            if (!entryA || !entryB) continue
            if (match.winnerId === a) {
                entryA.wins++
                entryB.losses++
                entryA.headToHead[b] = 'win'
                entryB.headToHead[a] = 'loss'
            } else if (match.winnerId === b) {
                entryB.wins++
                entryA.losses++
                entryB.headToHead[a] = 'win'
                entryA.headToHead[b] = 'loss'
            }
        }

        // 排序：胜场 desc → 胜负关系 → participantId 稳定排序
        return [...entries.values()].sort((x, y) => {
            if (y.wins !== x.wins) return y.wins - x.wins
            // tiebreak: head-to-head
            const h2h = x.headToHead[y.participantId]
            if (h2h === 'win') return -1
            if (h2h === 'loss') return 1
            return x.participantId.localeCompare(y.participantId)
        })
    })
}

// ────────────────────────────────────────
//  初始化完整的 Tournament 空壳（不含比赛结果）
// ────────────────────────────────────────

/**
 * 从参赛者列表创建完整的小组赛+淘汰赛赛程空壳。
 * 所有 MatchResult 的 winner/loser/scores 初始为 null/0。
 */
export function buildEmptyTournament(
    participants: TournamentParticipant[],
    playerId: string | null,
): { groupStage: GroupStageData; knockoutStage: KnockoutStageData } {
    const groups = buildGroupStage(participants)

    // 标记玩家比赛
    if (playerId) {
        for (const group of groups) {
            for (const match of group.matches) {
                if (match.participantIds.includes(playerId)) {
                    match.isPlayerMatch = true
                }
            }
        }
    }

    const standings = calculateGroupStandings(groups)

    const groupStage: GroupStageData = {
        groups,
        currentRound: 0,
        standings,
        qualifiers: [],
        finished: false,
    }

    // 淘汰赛暂时为空，等小组赛结束后再构建
    const emptyRounds: KnockoutRound[] = []
    for (let r = 0; r < KNOCKOUT_ROUNDS; r++) {
        emptyRounds.push({
            round: r,
            label: ROUND_LABELS[r],
            matches: [],
        })
    }

    const knockoutStage: KnockoutStageData = {
        rounds: emptyRounds,
        currentRound: 0,
        finished: false,
        championId: null,
    }

    return { groupStage, knockoutStage }
}

/**
 * 小组赛结束后，生成淘汰赛阶段。
 */
export function finalizeGroupStage(
    groups: GroupInfo[],
    playerId: string | null,
): { qualifiers: string[]; knockoutStage: KnockoutStageData } {
    const standings = calculateGroupStandings(groups)
    const qualifiers: string[] = []

    for (const entry of standings) {
        // 每组取前 2 名
        qualifiers.push(entry[0].participantId)
        if (entry.length >= 2) {
            qualifiers.push(entry[1].participantId)
        }
    }

    if (qualifiers.length !== KNOCKOUT_PARTICIPANTS) {
        throw new Error(`小组赛出线人数异常: ${qualifiers.length}，期望 ${KNOCKOUT_PARTICIPANTS}`)
    }

    const rounds = buildKnockoutBracket(qualifiers, groups)

    // 标记玩家比赛
    if (playerId) {
        for (const round of rounds) {
            for (const match of round.matches) {
                if (match.participantIds.includes(playerId)) {
                    if (!match.match) {
                        match.match = {
                            participantIds: match.participantIds as [string, string],
                            winnerId: null,
                            loserId: null,
                            scores: [0, 0],
                            bestOf: 3,
                            isPlayerMatch: true,
                        }
                    } else {
                        match.match.isPlayerMatch = true
                    }
                }
            }
        }
    }

    const knockoutStage: KnockoutStageData = {
        rounds,
        currentRound: 0,
        finished: false,
        championId: null,
    }

    return { qualifiers, knockoutStage }
}

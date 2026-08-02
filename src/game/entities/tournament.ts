// ════════════════════════════════════════
//  斗炁大会 — 纯数据类型定义
//  不包含任何逻辑，仅供外部引用。
// ════════════════════════════════════════

import type { LogEntry } from '../../bridge/replay-engine'

// ── 参赛者 ──

export interface TournamentParticipant {
    id: string
    name: string
    /** 是否为玩家本人 */
    isPlayer: boolean
    /** 给 gen() 的修炼等级 */
    level: number
    /** 种子排名（越高越强，用于分组平衡） */
    seed?: number
}

// ── 比赛结果 ──

export interface MatchResult {
    /** 两方 participant id */
    participantIds: [string, string]
    /** 胜者 id，null = 未打或平局 */
    winnerId: string | null
    /** 败者 id */
    loserId: string | null
    /** [A 胜场数, B 胜场数]，best of N 时记录明细 */
    scores: [number, number]
    /** 几局几胜（1 = BO1, 3 = BO3） */
    bestOf: number
    /** 是否包含玩家 */
    isPlayerMatch: boolean
    /** 每局明细（可选）。captureLogs 模拟时填充，用于 DevMode 逐局回放；不进 roguelite 持久化 */
    games?: MatchGame[]
}

/** 单局回放数据 */
export interface MatchGame {
    /** 本局胜者 participant id，null = 平局 */
    winnerId: string | null
    /** 本局 log 条目（引擎完整事件），供回放重建 BattleData */
    logEntries?: LogEntry[]
}

// ── 小组赛 ──

export interface GroupInfo {
    /** 组名 A-H */
    name: string
    /** 组内参赛者 id，可能 3 人或 4 人 */
    participantIds: string[]
    /** 组内所有比赛（3人组=3场，4人组=6场） */
    matches: MatchResult[]
}

export interface GroupStandingEntry {
    participantId: string
    wins: number
    losses: number
    /** 用于同胜场时按胜负关系 tiebreak */
    headToHead: Record<string, 'win' | 'loss'>
}

// ── 淘汰赛 ──

export interface KnockoutMatch {
    /** 轮次 0=十六强, 1=八强, 2=四强, 3=决赛 */
    round: number
    /** 该轮中的位置（0-based） */
    slotIndex: number
    /** 两方 participant id，null = 待定（等上一轮结果） */
    participantIds: [string | null, string | null]
    /** 比赛结果，null = 未打 */
    match: MatchResult | null
}

export interface KnockoutRound {
    round: number
    /** 中文名 "十六强" / "八强" / "四强" / "决赛" */
    label: string
    matches: KnockoutMatch[]
}

// ── 小组赛阶段 ──

export interface GroupStageData {
    groups: GroupInfo[]
    /** 当前轮次索引 0-2，打完 3 轮后为 3 */
    currentRound: number
    /** 每组积分榜（由 calculateGroupStandings 填充） */
    standings: GroupStandingEntry[][]
    /** 出线的 16 人 participant id */
    qualifiers: string[]
    /** 小组赛是否已结束 */
    finished: boolean
}

// ── 淘汰赛阶段 ──

export interface KnockoutStageData {
    /** 所有轮次，rounds[0]=十六强 … rounds[3]=决赛 */
    rounds: KnockoutRound[]
    /** 当前轮次索引，0=十六强，打完决赛后为 4 */
    currentRound: number
    /** 淘汰赛是否已结束 */
    finished: boolean
    /** 冠军 participant id */
    championId: string | null
}

// ── 大会阶段 ──

export type TournamentPhase = 'group_stage' | 'knockout' | 'finished'

// ── 完整赛程 ──

export interface TournamentData {
    name: string
    phase: TournamentPhase
    /** 所有参赛者 */
    participants: TournamentParticipant[]
    /** 玩家 id，null 表示纯 NPC 模拟 */
    playerId: string | null
    /** 指定的决赛对手 ID。若设置，该对手的所有非玩家比赛强制获胜（确保进决赛）。 */
    finalBossId?: string
    /** 小组赛数据，phase='group_stage' 时有效 */
    groupStage: GroupStageData
    /** 淘汰赛数据，phase='knockout' 或 'finished' 时有效 */
    knockoutStage: KnockoutStageData
}

// ── 轮次常量 ──

export const ROUND_LABELS: Record<number, string> = {
    0: '十六强',
    1: '八强',
    2: '四强',
    3: '决赛',
}

/** 小组赛最大轮数（每组 3 轮循环赛） */
export const GROUP_MAX_ROUNDS = 3
/** 淘汰赛轮数（16→8→4→2） */
export const KNOCKOUT_ROUNDS = 4
/** 淘汰赛参赛人数 */
export const KNOCKOUT_PARTICIPANTS = 16
/** 每组理想人数 */
export const GROUP_TARGET_SIZE = 4
/** 每组最少人数 */
export const GROUP_MIN_SIZE = 3
/** 小组总数 */
export const GROUP_COUNT = 8

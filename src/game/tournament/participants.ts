// ════════════════════════════════════════
//  participants — 参赛者选择逻辑
//  从 OPPONENTS 选人，加玩家，凑齐 32 人。
//  各故事线可通过参数控制排除名单和自定义选择。
// ════════════════════════════════════════

import type { TournamentParticipant } from '../entities/tournament'
import { OPPONENTS } from '../../data/opponents/index'

/** 从 OPPONENTS 中选择参赛者。 */
export interface SelectParticipantsOptions {
    /** 排除的对手 ID 列表（如故事线 Boss 不参赛） */
    excludeIds?: string[]
    /** 是否包含玩家 */
    includePlayer?: boolean
    /** 玩家 ID */
    playerId?: string
    /** 玩家名字 */
    playerName?: string
    /** 玩家修炼等级（给 gen() 用） */
    playerLevel?: number
    /** 所有 NPC 的默认修炼等级 */
    defaultLevel?: number
    /** 自定义种子排名：{ opponentId: seed }，缺省从 targetAttrs 总和推算 */
    seeds?: Record<string, number>
    /** 自定义选择函数：从可用列表中选出最终参赛者 */
    customSelect?: (available: typeof OPPONENTS, targetCount: number) => typeof OPPONENTS
}

const DEFAULT_LEVEL = 33

/**
 * 选择斗炁大会参赛者。
 *
 * 默认行为：从 OPPONENTS 排除 excludeIds 后，取前 31 人（或不足时全取），
 * 加玩家（可选），共 32 人。
 * 不足 32 人时用轮空处理（由 bracket-builder 处理）。
 */
export function selectParticipants(options: SelectParticipantsOptions = {}): TournamentParticipant[] {
    const {
        excludeIds = [],
        includePlayer = false,
        playerId = 'player',
        playerName = '你',
        playerLevel = DEFAULT_LEVEL,
        defaultLevel = DEFAULT_LEVEL,
        seeds,
        customSelect,
    } = options

    // 筛选可用对手
    let available = OPPONENTS.filter((o) => !excludeIds.includes(o.id))

    // 自定义选择
    const targetCount = includePlayer ? 31 : 32
    if (customSelect) {
        available = customSelect(available, targetCount)
    }

    // 计算种子排名（从 targetAttrs 总和推算）
    const participants: TournamentParticipant[] = available.map((o) => {
        const totalAttrs = Object.values(o.targetAttrs).reduce((s, v) => s + v, 0)
        const seed = seeds?.[o.id] ?? totalAttrs
        return {
            id: o.id,
            name: o.name,
            isPlayer: false,
            level: defaultLevel,
            seed,
        }
    })

    // 按 seed 排序，取前 targetCount 个
    participants.sort((a, b) => (b.seed ?? 0) - (a.seed ?? 0))
    const selected = participants.slice(0, targetCount)

    // 添加玩家
    if (includePlayer && playerId) {
        selected.push({
            id: playerId,
            name: playerName,
            isPlayer: true,
            level: playerLevel,
            seed: 9999, // 玩家永远第一种子（便于 UI 展示）
        })
    }

    return selected
}

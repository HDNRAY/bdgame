import type { RewardEntity, RewardType } from '../../game/entities/reward'
import { MAX_POINTS_REWARDS } from '../../game/entities/reward'
import type { Tag } from '../../engine/entities/tag'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'

/** 从数组中随机取 n 个不重复的元素 */
export function pickRandom<T>(arr: T[], n: number): T[] {
    const copy = [...arr]
    const result: T[] = []
    for (let i = 0; i < n && copy.length > 0; i++) {
        const idx = Math.floor(Math.random() * copy.length)
        result.push(copy[idx])
        copy.splice(idx, 1)
    }
    return result
}

/**
 * rewardFilter：仅保留与玩家武器 tags 关联的 2AP 招式。
 * 恰好 2AP、非 pre/post action，且 requiredTags 与武器 tags 有交集。
 * 用于 n3「选一个与兵器同源的 2AP 招式」。
 */
export function isWeaponBasicAction(item: RewardEntity, weaponTags: Tag[]): boolean {
    if (!('apCost' in item)) return false
    if (item.apCost !== 2) return false
    if (item.tags.includes('pre_action') || item.tags.includes('post_action')) return false
    if (item.requiredTags.length === 0) return false
    return item.requiredTags.some((t) => weaponTags.includes(t))
}

/**
 * rewardFilter：n3 招式候选（2AP、有 requiredTags、非 pre/post）。
 * 与武器 tags 的交集由引擎的 requiredTags 过滤完成（playerTags 含武器 tags）。
 */
export function isWeaponLinkedAction(item: RewardEntity): boolean {
    if (!('apCost' in item)) return false
    if (item.apCost !== 2) return false
    if (item.tags.includes('pre_action') || item.tags.includes('post_action')) return false
    return item.requiredTags.length > 0
}

/**
 * rewardFilter：仅保留初始可选武器（不含御物）。
 * 御物是玄门血统限定，非玄门线 n2 不出御物。
 */
export function isNonImperialStartingWeapon(item: RewardEntity): boolean {
    if (!('tags' in item)) return false
    return STARTING_WEAPONS.some((w) => w.id === item.id) && !item.tags.includes('imperial')
}

/** 淘汰赛 + 决赛节点（无奖励） */
export const NO_REWARD_NODES = new Set<number>([29, 30, 31, 33])

/** 不参与修炼点配额的非淘汰赛节点：n2/n3 必为实体奖励（选武器/选招式） */
const FIXED_ITEM_NODES = new Set<number>([2, 3])

/** 固定实体奖励事件：回忆事件固定三选一固有功法，不消耗修炼点配额 */
const FIXED_REWARD_EVENT = 'memory_within_memory'

/**
 * 统计从 fromIndex 起到 33 号节点为止，还可能发放修炼点的节点数（含当前节点）。
 * 排除：淘汰赛/决赛、n2/n3（必为实体奖励）、固定奖励事件（回忆）。
 */
export function countRewardOpportunities(nodes: { eventIds?: string[] }[], fromIndex: number): number {
    let count = 0
    for (let i = fromIndex; i <= 33; i++) {
        if (NO_REWARD_NODES.has(i)) continue
        if (FIXED_ITEM_NODES.has(i)) continue
        const ids = nodes[i - 1]?.eventIds ?? []
        if (ids.includes(FIXED_REWARD_EVENT)) continue
        count++
    }
    return count
}

/**
 * 动态修炼点配额：按「还需的修炼点 / 剩余机会」决定本轮奖励类型。
 *
 * - 淘汰赛/决赛 → 'none'（无奖励）
 * - n2/n3 → 必为实体奖励（选武器/选招式）
 * - 已达 16 次硬上限 → 不再给修炼点（实体奖励）
 * - need >= 机会数 → **强制修炼点**（快来不及达到 16 次了，不给 3 选 1）
 * - 否则按 need/机会数 的概率给修炼点：差得远就多出现，给多了就少出现
 */
export function resolveQuotaRewardType(
    nodeIndex: number,
    pointsGiven: number,
    naturalType: RewardType,
    opportunities = 0,
): RewardType | 'none' {
    if (NO_REWARD_NODES.has(nodeIndex)) return 'none'
    if (FIXED_ITEM_NODES.has(nodeIndex)) return itemFallback(naturalType)

    const need = MAX_POINTS_REWARDS - pointsGiven
    if (need <= 0) return itemFallback(naturalType) // 已打满 16 次
    if (opportunities <= 0) return itemFallback(naturalType)

    const prob = need / opportunities
    if (prob >= 1 || Math.random() < prob) {
        return 'points' // 强制或按概率给修炼点
    }
    return itemFallback(naturalType)
}

/** 非修炼点时：剧情感悟/医馆类节点分别降级为功法 / 保留疗伤，其余用自然类型 */
function itemFallback(naturalType: RewardType): RewardType {
    if (naturalType === 'points') return 'passive'
    return naturalType
}

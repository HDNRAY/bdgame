import type { RewardEntity } from '../../game/entities/reward'
import { MAX_POINTS_REWARDS } from '../../game/entities/reward'
import type { Tag } from '../../engine/entities/tag'
import type { NodeSpec } from '../../game/entities/node-spec'

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
 * 用于 n3「选一个与兵器同源的 2AP 招式」（审计/测试用）。
 */
export function isWeaponBasicAction(item: RewardEntity, weaponTags: Tag[]): boolean {
    if (!('apCost' in item)) return false
    if (item.apCost !== 2) return false
    if (item.tags.includes('pre_action') || item.tags.includes('post_action')) return false
    if (item.requiredTags.length === 0) return false
    return item.requiredTags.some((t) => weaponTags.includes(t))
}

/** 淘汰赛 + 决赛节点（无奖励） */
export const NO_REWARD_NODES = new Set<number>([29, 30, 31, 33])

/** 不参与修炼点配额的非淘汰赛节点：n2/n3 必为实体奖励（选武器/选招式） */
export const FIXED_ITEM_NODES = new Set<number>([2, 3])

/**
 * 统计从 fromIndex 起到 33 号节点为止，还可能发放修炼点的节点槽数（含当前节点）。
 * 渐进生成下按「节点槽结构」估算：排除淘汰赛/决赛、n2/n3（必为实体奖励）。
 */
export function countRewardOpportunities(nodes: NodeSpec[], fromIndex: number): number {
    let count = 0
    for (let i = fromIndex; i <= 33; i++) {
        if (NO_REWARD_NODES.has(i)) continue
        if (FIXED_ITEM_NODES.has(i)) continue
        if (!nodes[i - 1] || nodes[i - 1].candidates.length === 0) continue
        count++
    }
    return count
}

/**
 * 动态修炼点配额：按「还需的修炼点 / 剩余机会」决定本轮给修炼点还是实体奖励。
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
    opportunities = 0,
): 'points' | 'item' | 'none' {
    if (NO_REWARD_NODES.has(nodeIndex)) return 'none'
    if (FIXED_ITEM_NODES.has(nodeIndex)) return 'item'

    const need = MAX_POINTS_REWARDS - pointsGiven
    if (need <= 0) return 'item' // 已打满 16 次
    if (opportunities <= 0) return 'item'

    const prob = need / opportunities
    if (prob >= 1 || Math.random() < prob) {
        return 'points' // 强制或按概率给修炼点
    }
    return 'item'
}

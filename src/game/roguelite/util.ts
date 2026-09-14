import type { RewardEntity } from '../../game/entities/reward'
import { MAX_POINTS_REWARDS, TOTAL_REWARD_SLOTS } from '../../game/entities/reward'
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

/** 淘汰赛 + 决赛节点（无奖励）；n23 开幕的奖励为轮次级固定功法（不走修炼点配额） */
export const NO_REWARD_NODES = new Set<number>([23, 29, 30, 31, 33])

/** 不参与修炼点配额的非淘汰赛节点：n2/n3 必为实体奖励（选武器/选招式） */
export const FIXED_ITEM_NODES = new Set<number>([2, 3])

/** 败场伤势按阶段：一阶段 10 / 二阶段 15 / 三阶段 0（大会输了直接淘汰，伤势不再累积） */
export function injuryForNode(nodeIndex: number): number {
    if (nodeIndex <= 11) return 10
    if (nodeIndex <= 22) return 15
    return 0
}

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
 * 动态奖励配额（账本口径）：整局 29 个奖励槽 = 16 次修炼点 + 13 个实体奖励。
 *
 * - 淘汰赛/决赛 → 'none'（这些节点结构上就不发奖励：n29/n30/n31/n33）
 * - n2/n3 → 必为实体奖励（选武器/选招式），不走配额
 * - 已打满 16 次修炼点 → 'item'
 * - 其余按 need / 剩余机会的概率铺开：差得远就多出现，给多了就少出现
 *
 * `entityGiven` 是**实际已发的实体奖励数**（含 n1 开局奇物、n2/n3 兵器招式、n23 授艺与战利品等定点奖励）。
 * 一局能发奖励的节点是固定的 28 个（n23 双发 → 29 次），淘汰赛阶段一定不发，
 * 所以总数**结构上不可能超过 29**，这里不需要再写"发满了就返回「继续」"的兜底。
 * 分母取 min(剩余槽, 剩余机会)，越到后面 prob 越容易 ≥1 → 16 次修炼点必然发满，
 * 实体奖励就是 29 - 16 = 13 的余数。
 */
export function resolveQuotaRewardType(
    nodeIndex: number,
    pointsGiven: number,
    opportunities = 0,
    entityGiven = 0,
): 'points' | 'item' | 'none' {
    if (NO_REWARD_NODES.has(nodeIndex)) return 'none'
    if (FIXED_ITEM_NODES.has(nodeIndex)) return 'item'

    const need = MAX_POINTS_REWARDS - pointsGiven
    if (need <= 0) return 'item'

    const slotsLeft = Math.max(TOTAL_REWARD_SLOTS - pointsGiven - entityGiven, 1)
    // 关键：如果"再给一个实体，修炼点就来不及发满"，本轮必须给修炼点。
    // 用 need >= slotsLeft - 1（而不是 need >= slotsLeft）留一格余量，
    // 否则最后一轮可能被概率判成实体，收尾就只剩 15 次修炼点。
    if (need >= slotsLeft - 1) return 'points'

    const denom = Math.min(slotsLeft, Math.max(opportunities, 1))
    const prob = need / denom
    if (Math.random() < prob) {
        return 'points' // 按概率给修炼点：差得远就多出现，给多了就少出现
    }
    return 'item'
}

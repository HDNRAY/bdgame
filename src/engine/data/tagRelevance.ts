import type { Tag } from '../entities/tag'

/**
 * 根据玩家已有 tags 对候选奖励打分并排序。
 *
 * 规则:
 *   同武器类型 tag   → +3
 *   同属性/流派 tag  → +2
 *   同效果 tag       → +1
 *   完全无关联的排在最后（不排除，保持随机性）
 *
 * 玩家已拥有的奖励降权（避免连续出现同类项）。
 */

/** tag 分类权重 */
const TAG_WEIGHTS: Partial<Record<Tag, number>> = {
    // 武器类型 (权重最高)
    slash: 3,
    unarmed: 3,
    blunt: 3,
    pierce: 3,
    imperial: 3,
    polearm: 3,
    heavy: 3,
    melee: 3,
    dual_wield: 3,
    range: 3,
    // 属性/流派
    qi: 2,
    electric: 2,
    frost: 2,
    poison: 2,
    bleed: 2,
    burn: 2,
    damage: 2,
    summon: 2,
    defense: 2,
    // 效果 (权重最低)
    heal: 1,
    buff: 1,
    debuff: 1,
    stagger: 1,
    paralyze: 1,
    stun: 1,
    cleanse: 1,
    counter: 1,
    pre_action: 1,
    post_action: 1,
    move: 1,
    dot: 1,
    knockback: 1,
}

/**
 * 对候选奖励按与玩家已有 tags 的关联度排序。
 *
 * @param rewards   - 候选奖励列表
 * @param playerTags - 角色当前已拥有的 tags（来自武器/功法/奇物/招式）
 * @param ownedIds   - 角色已拥有的奖励 ID 列表（用于降权）
 * @returns 排序后的奖励列表（高分在前）
 */
export function sortByTagRelevance<T extends { id: string; tags: Tag[] }>(
    rewards: T[],
    playerTags: Tag[],
    ownedIds: string[] = [],
): T[] {
    const playerTagSet = new Set(playerTags)
    const ownedSet = new Set(ownedIds)

    return [...rewards].sort((a, b) => {
        const scoreA = scoreTags(a.tags, playerTagSet, ownedSet.has(a.id))
        const scoreB = scoreTags(b.tags, playerTagSet, ownedSet.has(b.id))
        return scoreB - scoreA
    })
}

function scoreTags(tags: Tag[], playerTags: Set<Tag>, isOwned: boolean): number {
    let score = 0
    for (const tag of tags) {
        if (playerTags.has(tag)) {
            score += TAG_WEIGHTS[tag] ?? 1
        }
    }
    // 已拥有的降权
    if (isOwned) score -= 5
    return score
}

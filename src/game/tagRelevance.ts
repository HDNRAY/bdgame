import type { Tag } from '../engine/entities/tag'

// ── tag 分级 ──
// 每类赋予不同权重，匹配时累加 score，用 2^score 做加权随机

const TAG_LEVELS: Record<string, Tag[]> = {
    /** 武器类型（核心 Build 方向）— 权重 4 */
    weaponType: ['unarmed', 'slash', 'blunt', 'pierce', 'polearm', 'heavy', 'melee', 'range', 'imperial', 'thrown'],
    /** 属性/流派 — 权重 2 */
    school: ['qi', 'electric', 'frost', 'poison', 'bleed', 'burn', 'summon', 'dual_wield'],
}

const LEVEL_WEIGHT: Record<string, number> = {
    weaponType: 4,
    school: 2,
}

/** 查找 tag 所在的等级，返回权重。不在任何等级中视为 1。 */
function tagScore(tag: Tag): number {
    for (const [key, tags] of Object.entries(TAG_LEVELS)) {
        if (tags.includes(tag)) return LEVEL_WEIGHT[key]
    }
    return 1
}

/**
 * 按与玩家 tags 的关联度，用加权随机从候选池中选取 count 个。
 *
 * 匹配 tag 越多权重指数级增长（×2^score），同一 tag 多次匹配只计一次。
 * weaponType（权重4）远重要于 school（权重2）和未分类 tag（权重1）。
 * 不匹配的项概率很低但仍有可能出现，保留随机性。
 */
export function pickWeightedByTags<T extends { id: string; tags: Tag[] }>(
    items: T[],
    playerTags: Tag[],
    count: number,
    ownedIds: string[] = [],
): T[] {
    const playerTagSet = new Set(playerTags)
    const ownedSet = new Set(ownedIds)
    const pool = [...items]
    const result: T[] = []

    for (let i = 0; i < count && pool.length > 0; i++) {
        const weights = pool.map((item) => {
            let score = 0
            const seen = new Set<Tag>()
            for (const tag of item.tags) {
                if (playerTagSet.has(tag) && !seen.has(tag)) {
                    seen.add(tag)
                    score += tagScore(tag)
                }
            }
            let w = Math.pow(2, score)
            if (ownedSet.has(item.id)) w *= 0.1
            return w
        })

        const total = weights.reduce((a, b) => a + b, 0)
        let rand = Math.random() * total
        let picked = 0
        for (let j = 0; j < pool.length; j++) {
            rand -= weights[j]
            if (rand <= 0) {
                picked = j
                break
            }
        }

        result.push(pool[picked])
        pool.splice(picked, 1)
    }

    return result
}

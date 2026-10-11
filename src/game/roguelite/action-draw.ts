import type { Tag } from '../../engine/entities/tag'
import { calcMaxAp } from '../../engine/calc/stats'
import { lcg, rng } from '../../engine/util/rng'

// ════════════════════════════════════════
//  「随机招式/奖励」抽取的两条规则（纯函数，可注入 rng 便于固定种子测试）
//
//  规则一（硬过滤）：消耗超过「角色当前 AP 上限（身法减免前）」的招式不进候选。
//    口径见 `playerApCap()`：引擎开局 `ap = maxAp`，而战斗内的「身法/急速减免」
//    作用在**消耗**上（`calcActionCostAfterSpeed`），不改上限；所以「身法减免前的
//    AP 上限」= 开局可支配的点数 = `calcMaxAp(当前根骨, 0)`（不含战斗内 maxApMod，
//    因为奖励是在战斗之外发的）。
//  规则二（随节点深入加权的 tag 关联性）：`weight = base * 2^(关联分 * relevanceWeight)`
//    关联分只按命中 tag 里**权重最高**的那一个算（武器类型 4 / 流派 2 / 其余 1，
//    功能 tag 0），不做「命中个数累加」——避免一个蹭了 move/heal 的杂牌招被
//    当成「很关联」压过武器同源招。
//
//  这两条只在**候选已经定死之后**动权重，不参与建池：
//  池子仍旧由 `_getActionPool()` 的两道闸（internal 标签 / `_` id 前缀）决定，
//  所以规则一、二不会让不该被学到的招式漏进奖励。
// ════════════════════════════════════════

/** 加权随节点深入的斜率：节点 1 时倍率为 1（接近均匀），节点 33 时最高 ×2^2.5 ≈ 5.66 */
export const RELEVANCE_SLOPE = 0.9
/** 深度归一分母：节点 1 为起点、节点 33 为终点（本作整局 33 个节点） */
export const MAX_NODE_INDEX = 33

/** 无 build 意义的功能 tag：不参与关联权重（与 `tagRelevance.ts` 同口径，不构成流派方向） */
const NO_BUILD_TAGS: Tag[] = ['move', 'pre_action', 'post_action', 'chan', 'heal', 'super_armor']
/** 武器类型 tag：与玩家武器同源 = 最强关联 */
const WEAPON_TYPE_TAGS: Tag[] = [
    'unarmed',
    'slash',
    'blunt',
    'pierce',
    'polearm',
    'heavy',
    'melee',
    'range',
    'imperial',
    'thrown',
]
/** 流派 tag：次强关联 */
const SCHOOL_TAGS: Tag[] = ['qi', 'electric', 'frost', 'poison', 'bleed', 'burn', 'summon']

/**
 * 角色当前 AP 上限（身法减免前）。根骨取 build 当前值（随局内修炼点成长），
 * 不含战斗内 maxApMod（奖励在战斗外发放，此时没有 buff 层）。
 */
export function playerApCap(vitality: number | undefined): number {
    return calcMaxAp(vitality ?? 0, 0)
}

/**
 * 单条 tag 的关联权重：武器类型 4 / 流派 2 / 其余 1 / 功能 tag 0。
 * 与 `tagRelevance.ts` 的 `tagScore` 同刻度（那边用于指数加权，这边用于指数加权的指数）。
 */
export function tagRelevanceScore(tag: Tag): number {
    if (NO_BUILD_TAGS.includes(tag)) return 0
    if (WEAPON_TYPE_TAGS.includes(tag)) return 4
    if (SCHOOL_TAGS.includes(tag)) return 2
    return 1
}

/** 候选与角色当前 tag 集合的关联分：取命中 tag 里的**最高**权重（无命中为 0）。 */
export function relevanceScore(itemTags: readonly Tag[], playerTags: readonly Tag[]): number {
    const player = new Set(playerTags)
    let best = 0
    for (const tag of itemTags) {
        if (!player.has(tag)) continue
        const s = tagRelevanceScore(tag)
        if (s > best) best = s
    }
    return best
}

/** 节点进度 [0,1]：首节点的关联权重不放大，末节点放到最大。 */
export function nodeProgress(nodeIndex: number): number {
    const span = MAX_NODE_INDEX - 1
    const p = (nodeIndex - 1) / span
    return Math.min(1, Math.max(0, p))
}

/** 节点带来的关联放大指数 e：节点 1 为 0（均匀），节点 33 为 RELEVANCE_SLOPE。 */
export function relevanceExponent(nodeIndex: number): number {
    return nodeProgress(nodeIndex) * RELEVANCE_SLOPE
}

/**
 * 规则一：排除消耗超过 AP 上限的招式。
 * 兜底：若一条都不剩（例如根骨极低而池子里全是高消耗大招），退回**全池成本最低**的那一档，
 * 保证抽得出招式、绝不出现空奖励轮。非招式实体（无 `apCost`）不受影响。
 */
export function filterByApCap<T extends { apCost?: number }>(items: T[], apCap: number): T[] {
    const allowed = items.filter((i) => !isOverApCap(i, apCap))
    if (allowed.length > 0) return allowed
    // 全超限 → 兜底放宽到最低成本档（不是全放开：仍尽量贴着当前上限）
    const costs = items.filter((i) => typeof i.apCost === 'number').map((i) => i.apCost as number)
    if (costs.length === 0) return items
    const cheapest = Math.min(...costs)
    return items.filter((i) => i.apCost === cheapest)
}

/** 单条是否超限（无 apCost 的实体一律通过）。 */
export function isOverApCap(item: { apCost?: number }, apCap: number): boolean {
    return typeof item.apCost === 'number' && item.apCost > apCap
}

export interface DrawContext<T extends { id: string; tags: Tag[]; apCost?: number }> {
    /** 候选池（已做完业务过滤，例如排除已拥有 / 事件 includeTags） */
    items: T[]
    /** 角色当前 tag 集合 */
    playerTags: Tag[]
    /** 当前节点号（1 起），决定关联权重的放大程度 */
    nodeIndex: number
    /** 要抽几个 */
    count: number
    /** 角色当前 AP 上限（身法减免前）；传 undefined 表示不做 AP 过滤 */
    apCap?: number
    /** 已拥有 id（同池内再抽到时降权，而不是直接排除） */
    ownedIds?: string[]
    /** 随机源；缺省用全局 rng（测试固定种子时注入 lcg） */
    rand?: () => number
    /**
     * 是否要求候选与角色有关联。
     * false（招式池口径，默认）：关联分 0 的候选权重固定 1 ——「不像我」的选项
     *   在后期只是变稀有、不会消失，池子多样性不被压成只剩一种 tag。
     * true（酒功之类按 tag 定向的事件池）：关联分 0 = 压根跑题，直接不给权重
     *   （全池都跑题时才退回普通加权，保证抽得出）。
     */
    requireRelevance?: boolean
}

/**
 * 「过滤（AP 上限）+ 按 tag 关联性加权（随 nodeIndex 增强）」的加权无放回抽取。
 * 返回选中的实体（最多 count 个）。
 */
export function drawRelevant<T extends { id: string; tags: Tag[]; apCost?: number }>(
    ctx: DrawContext<T>,
): T[] {
    const rand = ctx.rand ?? (() => rng.next())
    let pool = ctx.apCap === undefined ? [...ctx.items] : filterByApCap(ctx.items, ctx.apCap)
    const ownedSet = new Set(ctx.ownedIds ?? [])
    const exp = relevanceExponent(ctx.nodeIndex)
    const result: T[] = []

    for (let n = 0; n < ctx.count && pool.length > 0; n++) {
        // 定向池（requireRelevance）：先剔掉与角色毫无关联的候选，再谈权重
        const candidates = ctx.requireRelevance
            ? pool.filter((i) => relevanceScore(i.tags, ctx.playerTags) > 0)
            : pool
        const source = candidates.length > 0 ? candidates : pool
        const weights = source.map((item) => {
            const score = relevanceScore(item.tags, ctx.playerTags)
            // 关联分 0 → 权重固定 1：早期等同均匀抽样，后期保持「稀有但可抽到」
            const w = score <= 0 ? 1 : Math.pow(2, score * exp)
            return ownedSet.has(item.id) ? w * 0.1 : w
        })
        const total = weights.reduce((a, b) => a + b, 0)
        let pick = 0
        if (total > 0) {
            let r = rand() * total
            for (let i = 0; i < source.length; i++) {
                r -= weights[i]
                if (r <= 0) {
                    pick = i
                    break
                }
            }
        }
        const chosen = source[pick]
        result.push(chosen)
        pool = pool.filter((i) => i.id !== chosen.id)
    }
    return result
}

/** 固定种子随机源（测试与「可复现抽取」用；与 `rng.lcg` 同一条生成器，别另起一套） */
export function seededRand(seed: number): () => number {
    return lcg(seed)
}

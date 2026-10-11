import { describe, it, expect } from 'vitest'
import type { Tag } from '../../engine/entities/tag'
import { calcMaxAp } from '../../engine/calc/stats'
import { rewardPool } from '../roguelite/reward-pool'
import {
    drawRelevant,
    filterByApCap,
    playerApCap,
    relevanceExponent,
    relevanceScore,
    seededRand,
} from '../roguelite/action-draw'

// ════════════════════════════════════════
//  随机招式奖励的两条规则（`src/game/roguelite/action-draw.ts`）
//  规则一：消耗 > 当前 AP 上限（身法减免前 = calcMaxAp(根骨, 0)）的招式硬过滤
//  规则二：tag 关联性权重随 nodeIndex 递增（节点 1 均匀 → 节点 33 明显偏向）
//  另加：两条规则都不许绕过「internal 标签 / `_` id 前缀」两道闸
// ════════════════════════════════════════

/** 极简招式/实体（只为抽取逻辑造数据） */
interface Item {
    id: string
    tags: Tag[]
    apCost?: number
}

function mk(id: string, apCost: number, tags: Tag[]): Item {
    return { id, tags, apCost }
}

/** 陪跑池：不含武器/流派 tag 的杂牌招（关联分 0） */
const PLAIN: Item[] = [
    mk('plain_a', 2, ['move']),
    mk('plain_b', 2, ['heal']),
    mk('plain_c', 2, ['chan']),
    mk('plain_d', 2, ['post_action']),
]

/** 两个强关联招：slash（劈砍）与 heavy（重器）都带玩家已有的 melee（近战武器）tag → 关联分 4 */
const SLASH = mk('slash_a', 2, ['slash', 'melee'])
const HEAVY = mk('slash_b', 2, ['heavy', 'melee'])
const POOL: Item[] = [SLASH, HEAVY, ...PLAIN]

function slashRate(nodeIndex: number, seeds: number[]): number {
    const isWeaponType = (t: Tag[]) => t.includes('slash') || t.includes('heavy')
    let hits = 0
    let draws = 0
    for (const seed of seeds) {
        const picked = drawRelevant({
            items: POOL,
            playerTags: ['melee'],
            nodeIndex,
            count: 2,
            rand: seededRand(seed),
        })
        draws += picked.length
        hits += picked.filter((p) => isWeaponType(p.tags)).length
    }
    return hits / draws
}

describe('规则一：按当前 AP 上限过滤（身法减免前）', () => {
    it('AP 上限口径 = calcMaxAp(根骨, 0)，随根骨成长而变化', () => {
        // 引擎口径：开局 ap = maxAp = calcMaxAp(根骨, maxApMod=0)；身法/急速只减免**消耗**
        expect(playerApCap(3)).toBe(calcMaxAp(3, 0))
        expect(playerApCap(3)).toBe(5)
        expect(playerApCap(11)).toBe(7)
        expect(playerApCap(undefined)).toBe(calcMaxAp(0, 0))
        // 随局内成长（根骨变大 → 上限变大），不是开局的 3
        expect(playerApCap(11)).toBeGreaterThan(playerApCap(3))
    })

    it('过滤后所有候选的 apCost 都不超过上限；不限上限时不过滤', () => {
        const all = rewardPool.getPool('action') as Item[]
        const capped = filterByApCap(all, 3)
        expect(capped.length).toBeGreaterThan(0)
        expect(capped.every((a) => (a.apCost ?? 0) <= 3)).toBe(true)
        expect(filterByApCap(all, 99)).toHaveLength(all.length)
    })

    it('超限招式永远抽不到（真实池 + 100 个固定种子）', () => {
        const pool = rewardPool.getPool('action') as Item[]
        // 造一条必然超限的招式：从真实池找一条 apCost ≥ 4 的，缩到上限 3 之下
        const over = pool.find((a) => (a.apCost ?? 0) >= 4)
        expect(over).toBeDefined()
        const apCap = (over!.apCost ?? 0) - 1
        for (let seed = 1; seed <= 100; seed++) {
            const picked = drawRelevant({
                items: pool,
                playerTags: ['slash', 'melee'],
                nodeIndex: 20,
                count: 3,
                apCap,
                rand: seededRand(seed),
            })
            expect(picked.some((p) => p.id === over!.id)).toBe(false)
            for (const p of picked) expect(p.apCost ?? 0).toBeLessThanOrEqual(apCap)
        }
    })

    it('边界：池子被清空时走兜底，退回最低成本档（不会抽不出招式）', () => {
        const only: Item[] = [mk('big_a', 5, []), mk('big_b', 5, []), mk('big_c', 9, [])]
        const fallback = filterByApCap(only, 2)
        expect(fallback.map((i) => i.id)).toEqual(['big_a', 'big_b'])

        const picked = drawRelevant({
            items: only,
            playerTags: [],
            nodeIndex: 30,
            count: 3,
            apCap: 2,
            rand: seededRand(7),
        })
        expect(picked).toHaveLength(2)
        expect(picked.every((p) => p.apCost === 5)).toBe(true)

        // 真实招式池在最低上限（根骨 3 → 5AP）下也抽得出 3 条
        const real = rewardPool.getPool('action') as Item[]
        const realPick = drawRelevant({
            items: real,
            playerTags: [],
            nodeIndex: 1,
            count: 3,
            apCap: playerApCap(3),
            rand: seededRand(11),
        })
        expect(realPick).toHaveLength(3)
    })

    it('非招式实体（无 apCost）不受 AP 过滤影响', () => {
        const passives = rewardPool.getPool('passive') as Item[]
        expect(filterByApCap(passives, 1)).toHaveLength(passives.length)
    })
})

describe('规则二：tag 关联性权重随节点深入递增', () => {
    it('关联分取命中 tag 的最高权重（武器类型 4 / 流派 2 / 其余 1 / 功能 tag 0）', () => {
        expect(relevanceScore(['slash'], ['slash'])).toBe(4)
        expect(relevanceScore(['qi'], ['qi'])).toBe(2)
        expect(relevanceScore(['counter'], ['counter'])).toBe(1)
        expect(relevanceScore(['move', 'heal'], ['move', 'heal'])).toBe(0)
        expect(relevanceScore(['qi', 'slash'], ['slash'])).toBe(4)
        expect(relevanceScore(['slash'], ['blunt'])).toBe(0)
    })

    it('节点进度与放大指数：节点 1 为 0（均匀），节点 33 为最大', () => {
        expect(relevanceExponent(1)).toBe(0)
        expect(relevanceExponent(33)).toBeCloseTo(0.9, 6)
        expect(relevanceExponent(17)).toBeGreaterThan(0)
        expect(relevanceExponent(17)).toBeLessThan(relevanceExponent(33))
    })

    it('节点 1 关联权重不放大（早期 = 均匀随机）', () => {
        // 节点 1：exp=0 → 所有候选项权重都等于 1（关联分不影响）
        // 种子用 i*31+7：LCG 的首个输出是种子的仿射函数，连续的种子（1,2,3…）会让首抽集中在
        // 一个窄区间里（实测只落在 index 1/2），必须让种子本身散开。
        const seeds = Array.from({ length: 500 }, (_, i) => i * 31 + 7)
        let weaponTypeShare = 0
        for (const seed of seeds) {
            const picked = drawRelevant({
                items: POOL,
                playerTags: ['melee'],
                nodeIndex: 1,
                count: 1,
                rand: seededRand(seed),
            })
            if (relevanceScore(picked[0].tags, ['melee']) > 0) weaponTypeShare++
        }
        // 均匀池：6 条里 2 条带武器类型 tag
        const uniform = 2 / 6
        expect(weaponTypeShare / seeds.length).toBeGreaterThan(uniform - 0.06)
        expect(weaponTypeShare / seeds.length).toBeLessThan(uniform + 0.06)
        // 对照：节点 33 同一批种子明显偏向关联项
        let lateShare = 0
        for (const seed of seeds) {
            const picked = drawRelevant({
                items: POOL,
                playerTags: ['melee'],
                nodeIndex: 33,
                count: 1,
                rand: seededRand(seed),
            })
            if (relevanceScore(picked[0].tags, ['melee']) > 0) lateShare++
        }
        expect(lateShare / seeds.length).toBeGreaterThan(weaponTypeShare / seeds.length + 0.3)
    })

    it('固定种子实测：后期选中关联招式的比例显著高于早期', () => {
        const seeds = Array.from({ length: 500 }, (_, i) => i * 31 + 7)
        const early = slashRate(1, seeds) // 节点 1
        const late = slashRate(33, seeds) // 节点 33
        // 均匀基线（节点 1 权重全为 1，抽 2 条不重复）：
        // 首抽命中 1/3；若首抽不中(2/3)则次抽命中 2/5 → 每条 1/3、两条合计 2/3 → 平均命中 1/3。
        // 实测 0.335（与 1/3 同量级）。
        const uniform = 1 / 3
        // 早期 ≈ 均匀基线；后期显著更高
        expect(early).toBeGreaterThan(uniform - 0.06)
        expect(early).toBeLessThan(uniform + 0.06)
        expect(late).toBeGreaterThan(early + 0.15)
        expect(late).toBeGreaterThan(0.72)
        // eslint-disable-next-line no-console
        console.log(
            `[实测] 关联招式占比 早期(n1)=${early.toFixed(3)} 后期(n33)=${late.toFixed(3)} 均匀基线=${uniform.toFixed(3)}`,
        )
    })

    it('抑制手段：关联分 0 的候选在后期只是变稀有，不会从池子里消失', () => {
        let plainPicked = 0
        for (let seed = 1; seed <= 300; seed++) {
            const picked = drawRelevant({
                items: POOL,
                playerTags: ['melee'],
                nodeIndex: 33,
                count: 3,
                rand: seededRand(seed),
            })
            plainPicked += picked.filter((p) => relevanceScore(p.tags, ['melee']) === 0).length
        }
        expect(plainPicked).toBeGreaterThan(0)
    })
})

describe('两道闸仍然生效：internal 标签 / `_` id 前缀', () => {
    it('池子本身不含 internal 与 `_` 前缀招式', () => {
        const pool = rewardPool.getPool('action') as Item[]
        for (const a of pool) {
            expect(a.id.startsWith('_')).toBe(false)
            expect(a.tags.includes('internal')).toBe(false)
        }
    })

    it('走新抽取函数（各种节点/上限/种子）也抽不到 internal 或 `_` 前缀招式', () => {
        const pool = rewardPool.getPool('action') as Item[]
        for (const nodeIndex of [1, 9, 17, 25, 33]) {
            for (const apCap of [2, 5, 12]) {
                for (let seed = 1; seed <= 50; seed++) {
                    const picked = drawRelevant({
                        items: pool,
                        playerTags: ['slash', 'qi', 'melee'],
                        nodeIndex,
                        count: 3,
                        apCap,
                        rand: seededRand(seed),
                    })
                    for (const p of picked) {
                        expect(p.id.startsWith('_')).toBe(false)
                        expect(p.tags.includes('internal')).toBe(false)
                    }
                }
            }
        }
    })
})

describe('变异验证：两条规则各自去掉，对应用例必须红', () => {
    it('去掉规则一（不传 apCap 等价关闭过滤）→ 超限招式漏进候选', () => {
        const pool = rewardPool.getPool('action') as Item[]
        const over = pool.find((a) => (a.apCost ?? 0) >= 4)!
        const apCap = (over.apCost ?? 0) - 1
        let leaked = false
        for (let seed = 1; seed <= 100 && !leaked; seed++) {
            const picked = drawRelevant({
                items: pool,
                playerTags: ['slash'],
                nodeIndex: 20,
                count: 3,
                // apCap 故意不传 = 规则一失效
                rand: seededRand(seed),
            })
            leaked = picked.some((p) => (p.apCost ?? 0) > apCap)
        }
        expect(leaked).toBe(true)
    })

    it('去掉规则二（斜率降为 0 等价关闭关联加权）→ 早期/后期比例不再有差', () => {
        // 变异实现：把斜率当 0 传进同一条公式（exp 恒为 0 → 权重全 1 → 与均匀抽样等价）
        const mutantRate = (nodeIndex: number, seeds: number[]): number => {
            const exp = relevanceExponent(nodeIndex) * 0 // ← 规则二失效
            let hits = 0
            let draws = 0
            for (const seed of seeds) {
                const rand = seededRand(seed)
                const pool = [...POOL]
                const picked: Item[] = []
                for (let n = 0; n < 2 && pool.length > 0; n++) {
                    const weights = pool.map((i) => {
                        const s = relevanceScore(i.tags, ['melee'])
                        return s <= 0 ? 1 : Math.pow(2, s * exp)
                    })
                    const total = weights.reduce((a, b) => a + b, 0)
                    let r = rand() * total
                    let pick = 0
                    for (let i = 0; i < pool.length; i++) {
                        r -= weights[i]
                        if (r <= 0) {
                            pick = i
                            break
                        }
                    }
                    picked.push(pool[pick])
                    pool.splice(pick, 1)
                }
                draws += picked.length
                hits += picked.filter((p) => p.tags.includes('slash') || p.tags.includes('heavy')).length
            }
            return hits / draws
        }
        const seeds = Array.from({ length: 400 }, (_, i) => i * 17 + 3)
        const mutantEarly = mutantRate(1, seeds)
        const mutantLate = mutantRate(33, seeds)
        // 规则二失效 → n1 与 n33 只剩抽样噪声，落在均匀基线（≈1/3）附近
        const uniform = 1 / 3
        expect(mutantEarly).toBeGreaterThan(uniform - 0.06)
        expect(mutantEarly).toBeLessThan(uniform + 0.06)
        expect(mutantLate).toBeGreaterThan(uniform - 0.06)
        expect(mutantLate).toBeLessThan(uniform + 0.06)
        // 对照组：真实现（规则二生效）的后期比例显著更高
        expect(slashRate(33, seeds)).toBeGreaterThan(mutantLate + 0.15)
    })
})

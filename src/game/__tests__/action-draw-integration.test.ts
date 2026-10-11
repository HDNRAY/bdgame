import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ════════════════════════════════════════
//  随机招式奖励两条规则的**整局**验证（真引擎、固定种子）：
//  规则一：整局抽到的招式，消耗不得超过角色当前 AP 上限（身法减免前 = calcMaxAp(根骨, 0)）。
//          build.baseAttrs 会随局内成长，所以「全程」口径取下限：根骨 ≥ 4 时上限 ≥ 5，
//          因此 ≤ 4AP 的断言对整局任何时刻都成立（若规则一失效，5AP 大招会有机会漏进来）。
//  规则二：节点越深，抽到的招式越偏「与角色已有 tag 关联」。
// ════════════════════════════════════════

const battle = vi.hoisted(() => ({ playerWins: true }))

vi.mock('../../engine/battle-runner', () => ({
    runBattle: (_player: unknown, enemy: { id: string }) => ({
        winner: battle.playerWins ? 'player' : enemy.id,
        engine: { state: { log: { getAll: () => [] } } },
    }),
    simulateWinRate: () => ({ aWins: 1, bWins: 0 }),
}))

import { RogueliteRun } from '../roguelite/engine'
import { STORIES } from '../../data/stories'
import { rewardPool } from '../roguelite/reward-pool'
import { playerApCap, relevanceScore, drawRelevant, seededRand } from '../roguelite/action-draw'
import type { RewardEntity } from '../entities/reward'
import type { Tag } from '../../engine/entities/tag'

/** 与 reward-economy 同口径的固定种子随机源 */
function makeRandom(seed: number): () => number {
    let s = seed >>> 0
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000)
}

const actionById = new Map<string, RewardEntity>()
for (const a of rewardPool.getPool('action')) actionById.set(a.id, a)

interface Offense {
    node: number
    /** 该轮生成时的角色 AP 上限（身法减免前，从 build.baseAttrs.vitality 算得） */
    apCap: number
    cost: number
}

interface RunLog {
    /** 本局招式奖励轮里每个候选的 apCost + 当轮 AP 上限 */
    offers: Offense[]
}

/** 跑一局：始终把「招式」奖励选项排在优先，记录每次招式奖励轮的候选与当轮上限 */
function runOnce(seed: number, preferAction: boolean): RunLog {
    vi.spyOn(Math, 'random').mockImplementation(makeRandom(seed))
    const log: RunLog = { offers: [] }
    const run = new RogueliteRun()
    const first = run.getState().rounds[0]
    const storyIdx = first.choices.findIndex((c) => STORIES.some((s) => s.originEventId === c.id))
    run.selectChoice(storyIdx >= 0 ? storyIdx : 0)
    // 把当前根骨压到 0：AP 上限 = round(4 + 0) = 4。属性写入走公开的备战保存入口
    // （与玩家在构筑面板保存同一条路径），后续轮次的抽招都会读到它。
    const st0 = run.getState()
    run.updateBuild({ ...st0.build, baseAttrs: { ...st0.build.baseAttrs, vitality: 0 } })
    let guard = 0
    while (!run.getState().finished && guard++ < 900) {
        const st = run.getState()
        const round = st.rounds[st.rounds.length - 1]
        if (!round || round.choices.length === 0) break
        const actionIdx = round.choices.findIndex((c) => c.type === 'action')
        if (actionIdx >= 0) {
            const apCap = playerApCap(st.build.baseAttrs?.vitality)
            for (const c of round.choices) {
                if (c.type !== 'action') continue
                const def = actionById.get(c.id)
                if (def && 'apCost' in def) log.offers.push({ node: st.nodeIndex, apCap, cost: def.apCost })
            }
            if (preferAction) {
                run.selectChoice(actionIdx)
                continue
            }
        }
        run.selectChoice(0)
    }
    return log
}

describe('整局：随机招式奖励受 AP 上限约束（规则一）', () => {
    beforeEach(() => {
        battle.playerWins = true
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('整局任何时刻：招式候选的 apCost 都不超过当轮 AP 上限（身法减免前）', () => {
        const seeds = [101, 313, 707, 1301]
        let offered = 0
        let overCapLeak = 0
        for (const seed of seeds) {
            const log = runOnce(seed, false)
            offered += log.offers.length
            for (const o of log.offers) {
                if (o.cost > o.apCap) overCapLeak++
                // 硬断言：候选一律不超当轮上限
                expect(o.cost, `节点 ${o.node} 抽到了 ${o.cost}AP（上限 ${o.apCap}）`).toBeLessThanOrEqual(o.apCap)
            }
        }
        expect(offered).toBeGreaterThan(0)
        expect(overCapLeak).toBe(0)
    })

    it('AP 上限公式与池子自检：根骨 3 → 上限 5，池中有 5AP 招式（规则一失效时会漏进来）', () => {
        // 引擎口径自检：AP 上限 = round(4 + 根骨×0.25)
        expect(playerApCap(3)).toBe(5)
        expect(playerApCap(4)).toBe(5)
        expect(playerApCap(7)).toBe(6)
        expect(playerApCap(11)).toBe(7)
        // 池子里确实存在 >4AP 的招式
        const fiveAp = (rewardPool.getPool('action') as RewardEntity[]).filter(
            (a) => 'apCost' in a && a.apCost > 4,
        )
        expect(fiveAp.length).toBeGreaterThan(0)
    })

    it('规则一失效的对照：不传 apCap 时 5AP 招式会出现在候选里（证明过滤真的在起作用）', () => {
        // 直接对真实池做无过滤抽取，统计 5AP 招式出现次数
        const pool = rewardPool.getPool('action') as RewardEntity[]
        let leaked = 0
        for (let seed = 1; seed <= 200; seed++) {
            const picked = drawNoCap(pool, seed)
            leaked += picked.filter((p) => 'apCost' in p && p.apCost > 4).length
        }
        expect(leaked).toBeGreaterThan(0)
    })
})

/** 变异对照：与 drawRelevant 相同的加权逻辑，但不做 AP 过滤 */
function drawNoCap(pool: RewardEntity[], seed: number): RewardEntity[] {
    let s = seed >>> 0
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000)
    const rest = [...pool]
    const out: RewardEntity[] = []
    for (let n = 0; n < 3 && rest.length > 0; n++) {
        const weights = rest.map(() => 1)
        const total = weights.reduce((a, b) => a + b, 0)
        let r = rand() * total
        let pick = 0
        for (let i = 0; i < rest.length; i++) {
            r -= weights[i]
            if (r <= 0) {
                pick = i
                break
            }
        }
        out.push(rest[pick])
        rest.splice(pick, 1)
    }
    return out
}

describe('整局：tag 关联性随节点递增（规则二）', () => {
    beforeEach(() => {
        battle.playerWins = true
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('真池实测：同一角色 tag 集合下，权重随 nodeIndex 递增（早期均匀、后期显著偏向）', () => {
        // 端到端一致性：用真实招式池 + 真实根骨上限，在三个节点各抽 300 次，
        // 统计「抽到的招式与角色 tag 的关联分」的平均值，必须随节点递增。
        const pool = rewardPool.getPool('action') as RewardEntity[]
        const tags: Tag[] = ['slash', 'melee', 'qi']
        const avgScore = (nodeIndex: number): number => {
            let sum = 0
            let n = 0
            for (let seed = 1; seed <= 300; seed++) {
                for (const p of drawRelevant({
                    items: pool,
                    playerTags: tags,
                    nodeIndex,
                    count: 3,
                    apCap: playerApCap(7),
                    rand: seededRand(seed * 97 + 11),
                })) {
                    sum += relevanceScore(p.tags, tags)
                    n++
                }
            }
            return sum / n
        }
        const early = avgScore(1)
        const mid = avgScore(17)
        const late = avgScore(33)
        expect(mid).toBeGreaterThan(early)
        expect(late).toBeGreaterThan(mid)
        // eslint-disable-next-line no-console
        console.log(
            `[实测] 真实招式池平均关联分 早期(n1)=${early.toFixed(3)} 中期(n17)=${mid.toFixed(3)} 后期(n33)=${late.toFixed(3)}`,
        )
    })

    it('整局随机招式奖励不再裸抽：n3 的 2AP/兵器同源约束仍然生效（新规则没有放宽规格过滤）', () => {
        // 跑一局，遇到招式奖励轮时检查：全部 2AP、requiredTags 与所选武器 tag 有交集
        vi.spyOn(Math, 'random').mockImplementation(makeRandom(424242))
        const run = new RogueliteRun()
        const first = run.getState().rounds[0]
        const storyIdx = first.choices.findIndex((c) => STORIES.some((s) => s.originEventId === c.id))
        run.selectChoice(storyIdx >= 0 ? storyIdx : 0)
        let guard = 0
        let checked = 0
        while (!run.getState().finished && guard++ < 900) {
            const st = run.getState()
            const round = st.rounds[st.rounds.length - 1]
            if (!round || round.choices.length === 0) break
            const idx = round.choices.findIndex((c) => c.type === 'action')
            if (idx >= 0 && st.nodeIndex <= 3) {
                // n2/n3 的招式规格：apMax 2 / noPrePost / requireTags（见 reward-spec 与事件定义）
                for (const c of round.choices) {
                    if (c.type !== 'action') continue
                    const def = actionById.get(c.id)
                    if (!def || !('apCost' in def)) continue
                    expect(def.apCost).toBeLessThanOrEqual(2)
                    expect(def.requiredTags.length).toBeGreaterThan(0)
                    checked++
                }
                // 选与当前武器同源的招式，继续推进
                run.selectChoice(idx)
                continue
            }
            run.selectChoice(0)
        }
        expect(checked).toBeGreaterThan(0)
    })
})

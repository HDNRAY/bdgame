import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ════════════════════════════════════════
//  一局奖励收支不变量
//  整局奖励机会约 29 次：16 次修炼点 + 13 个实体奖励（无论哪条故事线）。
//  配额按 TOTAL_REWARD_SLOTS 账本发放：修炼点用 need/剩余槽 铺开、必须发满 16 次；
//  实体奖励是余数，约 13 个（150 局扫描实测 12~14）。
//  硬要求：**合计不超过 29**（n29/30/31/33 淘汰赛结构上不发奖励）；修炼点必须 16 次。
//  n1 的开局奖励（4 点修炼点 / 天生道种那条线的奇物）算在账本内。
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
import { ENTITY_REWARD_SLOTS, MAX_POINTS_REWARDS } from '../entities/reward'

/** 线性同余伪随机（与 event-reward-audit 同一口径）：一个种子定一整局的随机序列 */
function makeRandom(seed: number): () => number {
    let s = seed >>> 0
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000)
}

/** 当前局的随机源；由 describe 的 beforeEach 装到 Math.random 上，ledgerOf 每次开局换种子 */
let randomImpl: () => number = makeRandom(1)

/** 贪心：能拿实体奖励就拿（另一个策略是永远选第一项，两者结果应一致） */
function chooseEntityFirst(run: RogueliteRun): number {
    const st = run.getState()
    const r = st.rounds[st.rounds.length - 1]
    if (!r) return 0
    const i = r.choices.findIndex((c) => ['weapon', 'action', 'passive', 'artifact'].includes(c.type))
    return i >= 0 ? i : 0
}

interface Ledger {
    finished: boolean
    /** 本局实际跑的故事线（必须等于用例请求的那条） */
    story: string | undefined
    entities: number
    points: number
}

/**
 * 跑完一局（固定胜负、种子随机），返回收尾账本。
 *
 * n1 出身是随机 3 选 1：抽不到目标线就**换种子重开**，绝不退化成第一项。
 * （旧写法对 `findIndex` 的 -1 直接调 `selectChoice(-1)` —— 那是空操作，于是
 * 循环里自动选了第一项，feud/wanderer 的用例实际跑在别的故事线上，测试在说谎。）
 */
function ledgerOf(storyId: string, chooser: (run: RogueliteRun) => number): Ledger {
    const story = STORIES.find((s) => s.id === storyId)
    if (!story) throw new Error(`没有故事线 ${storyId}`)
    for (let attempt = 0; attempt < 60; attempt++) {
        randomImpl = makeRandom(attempt * 7919 + 1013904223)
        battle.playerWins = true
        const run = new RogueliteRun()
        const first = run.getState().rounds[0]
        const idx = first.choices.findIndex((c) => c.id === story.originEventId)
        if (idx < 0) continue // 本局没抽到目标线：换种子重开
        run.selectChoice(idx)
        let guard = 0
        while (!run.getState().finished && guard++ < 900) {
            const st = run.getState()
            const round = st.rounds[st.rounds.length - 1]
            if (!round || round.choices.length === 0) break
            run.selectChoice(chooser(run))
        }
        const st = run.getState()
        return {
            finished: st.finished,
            story: st.build.story,
            entities: st.build.rewards.length,
            points: Number(st.flags['points_granted'] ?? 0),
        }
    }
    throw new Error(`60 次开局均未抽到故事 ${storyId}`)
}

describe('一局奖励收支：16 次修炼点 + 13 个实体奖励 = 29', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockImplementation(() => randomImpl())
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    for (const story of STORIES) {
        it(`${story.id}：约 13 实体 + 满 16 次修炼点`, () => {
            const got = ledgerOf(story.id, chooseEntityFirst)
            // 先把"确实跑在目标故事线上"钉死，避免以后又静默退化去跑别的线
            expect(got.story).toBe(story.id)
            expect(got.finished).toBe(true)
            // 实体奖励"大约 13"：实测区间 12~14
            expect(got.entities).toBeGreaterThanOrEqual(ENTITY_REWARD_SLOTS - 1)
            expect(got.entities).toBeLessThanOrEqual(ENTITY_REWARD_SLOTS + 1)
            // 硬性：合计不超过 29
            expect(got.entities + got.points).toBeLessThanOrEqual(29)
            // 修炼点是硬指标：必须正好 16 次
            expect(got.points).toBe(MAX_POINTS_REWARDS)
        })
    }

    it('换成"永远选第一项"的策略，拆分不变（修炼点轮是唯一选项）', () => {
        const got = ledgerOf('veteran', () => 0)
        expect(got.story).toBe('veteran')
        expect(got.entities).toBeGreaterThanOrEqual(ENTITY_REWARD_SLOTS - 1)
        expect(got.entities).toBeLessThanOrEqual(ENTITY_REWARD_SLOTS + 1)
        expect(got.entities + got.points).toBeLessThanOrEqual(29)
        expect(got.points).toBe(MAX_POINTS_REWARDS)
    })
})

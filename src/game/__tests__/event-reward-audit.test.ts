import { describe, it, expect, vi, afterEach } from 'vitest'

// ════════════════════════════════════════
//  事件奖励数据审计
//  这次抓到的两类数据 bug,都以 UT 固化下来：
//    1) 事件完全发不出奖励（如「路见不平」原来三个选项全是 __end__；血海线「阿九」缺空奖励轮）
//    2) 一个节点连发两次奖励（如「天工坊」跳分支后顺次走到兄弟分支的奖励轮；
//       「多林寺问禅」三个分支的奖励轮相邻，走完一个会继续走下一个）
//  外加一次小规模动态扫描：多局收尾必须满足硬约束（合计 ≤ 29、每节点至多一次奖励）。
// ════════════════════════════════════════

const battle = vi.hoisted(() => ({ playerWins: true }))

vi.mock('../../engine/battle-runner', () => ({
    runBattle: (_player: unknown, enemy: { id: string }) => ({
        winner: battle.playerWins ? 'player' : enemy.id,
        engine: { state: { log: { getAll: () => [] } } },
    }),
    simulateWinRate: () => ({ aWins: 1, bWins: 0 }),
}))

import { ALL_EVENTS } from '../../data/events'
import { RogueliteRun } from '../roguelite/engine'
import { STORIES } from '../../data/stories'
import { getEvent } from '../../data/events'

interface RoundLike {
    id?: string
    title?: string
    choices?: { id?: string; type?: string }[]
    reward?: { kind?: string }
    enemyId?: string
    enemyPool?: string[]
    tutorial?: unknown
}
interface EventLike {
    id: string
    name?: string
    reward?: { kind?: string }
    rounds?: RoundLike[]
}

const ENTITY_TYPES = new Set(['weapon', 'action', 'passive', 'artifact', 'points'])

/** 这一轮会不会发奖励 */
function roundRewards(r: RoundLike, ev: EventLike): boolean {
    const picks = r.choices ?? []
    if (picks.length > 0) return picks.some((c) => ENTITY_TYPES.has(c.type ?? ''))
    const kind = r.reward?.kind ?? ev.reward?.kind
    return !!kind && kind !== 'none'
}

/** 结构上由引擎/剧情单独处理、不参与本审计的事件 */
function exempt(ev: EventLike): boolean {
    return (
        ev.id.startsWith('origin_') || // 出身场景：奖励由故事线 storyRewardEffects 发放
        ev.id.startsWith('tournament_') || // 大会赛程：n23/n26-n28 轮级固定奖励、淘汰赛无奖励
        ev.id.startsWith('pick_') // 出身选择轮：奖励同上由故事线发放
    )
}

describe('事件奖励数据审计（静态）', () => {
    it('每个事件都发得出奖励（至少一轮能发）', () => {
        const dead: string[] = []
        for (const raw of ALL_EVENTS as unknown as EventLike[]) {
            if (exempt(raw)) continue
            const rounds = raw.rounds ?? []
            if (rounds.length === 0) continue
            if (!rounds.some((r) => roundRewards(r, raw))) dead.push(raw.name ?? raw.id)
        }
        expect(dead).toEqual([])
    })

    it('不会连着两轮都发奖励（跳分支后顺次走兄弟分支就会这样，需要中间插一个 __end__ 收尾轮）', () => {
        const adjacent: string[] = []
        for (const raw of ALL_EVENTS as unknown as EventLike[]) {
            if (exempt(raw)) continue
            const rounds = raw.rounds ?? []
            for (let i = 0; i + 1 < rounds.length; i++) {
                if (roundRewards(rounds[i], raw) && roundRewards(rounds[i + 1], raw)) {
                    adjacent.push(`${raw.name ?? raw.id}: [${rounds[i].title ?? rounds[i].id}] → [${rounds[i + 1].title ?? rounds[i + 1].id}]`)
                }
            }
        }
        expect(adjacent).toEqual([])
    })
})

describe('事件奖励数据审计（动态：3 种子 × 5 线）', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    function makeRandom(seed: number): () => number {
        let s = seed >>> 0
        return () => {
            s = (s * 1664525 + 1013904223) >>> 0
            return s / 4294967296
        }
    }

    it('合计 ≤ 29、每个节点至多发一次奖励、每个非淘汰赛节点都发得出奖励', () => {
        const problems: string[] = []
        // 淘汰赛阶段（n29/30/31/33）结构上不发奖励；其余节点都必须发一次
        const NO_REWARD_NODES = new Set([29, 30, 31, 33])
        const EXPECT_NODES = Array.from({ length: 32 }, (_, i) => i + 1).filter((n) => !NO_REWARD_NODES.has(n))
        for (const story of STORIES) {
            for (let seed = 1; seed <= 3; seed++) {
                vi.spyOn(Math, 'random').mockImplementation(makeRandom(seed * 7919 + story.id.length * 104729))
                battle.playerWins = true
                const run = new RogueliteRun()
                const perNode = new Map<number, number>()
                const titles = new Map<number, string[]>()
                // 选出身这一步就会发开局奖励（n1），同样计入节点统计
                const first = run.getState().rounds[0]
                const before0 = run.getState().build.rewards.length + Number(run.getState().flags['points_granted'] ?? 0)
                run.selectChoice(first.choices.findIndex((c) => c.label === getEvent(story.originEventId)?.name))
                const after0 = run.getState()
                if (after0.build.rewards.length + Number(after0.flags['points_granted'] ?? 0) > before0) perNode.set(1, 1)
                let guard = 0
                while (!run.getState().finished && guard++ < 900) {
                    const st = run.getState()
                    const r = st.rounds[st.rounds.length - 1]
                    if (!r || r.choices.length === 0) break
                    const i = r.choices.findIndex((c) => ENTITY_TYPES.has(c.type))
                    const before = st.build.rewards.length + Number(st.flags['points_granted'] ?? 0)
                    run.selectChoice(i >= 0 ? i : 0)
                    const after = run.getState()
                    const gained = after.build.rewards.length + Number(after.flags['points_granted'] ?? 0) - before
                    if (gained > 0) perNode.set(st.nodeIndex, (perNode.get(st.nodeIndex) ?? 0) + 1)
                    titles.set(st.nodeIndex, [...(titles.get(st.nodeIndex) ?? []), r.title ?? ''])
                }
                const st = run.getState()
                const points = Number(st.flags['points_granted'] ?? 0)
                const total = st.build.rewards.length + points
                if (total > 29) problems.push(`${story.id}#${seed}: 合计 ${total} > 29`)
                for (const [node, count] of perNode) {
                    if (count > 1) problems.push(`${story.id}#${seed}: n${node} 发了 ${count} 次奖励`)
                }
                if (st.build.rewards.length < 12) problems.push(`${story.id}#${seed}: 实体只有 ${st.build.rewards.length}`)
                for (const node of EXPECT_NODES) {
                    if (!perNode.has(node)) {
                        problems.push(`${story.id}#${seed} n${node} 没发奖励 [${(titles.get(node) ?? []).join('/')}]`)
                    }
                }
            }
        }
        expect(problems).toEqual([])
    })
})

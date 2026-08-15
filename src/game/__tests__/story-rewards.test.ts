import { describe, it, expect, vi } from 'vitest'
import { RogueliteRun } from '../roguelite/engine'
import type { GameState } from '../entities/state'
import { getEvent } from '../../data/events/index'
import { STORIES } from '../../data/stories/index'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { rewardPool } from '../roguelite/reward-pool'
import { isWeaponBasicAction, resolveQuotaRewardType, countRewardOpportunities } from '../roguelite/util'
import { MAX_POINTS_REWARDS } from '../entities/reward'
import { TIANGONG_WEAPON, MEMORY_WITHIN_MEMORY, WATERFALL_EPIPHANY } from '../../data/events/branch'

/** 开一局，反复抽出身直到出现指定故事，选中后返回状态（地图已叠加完成）。 */
function pickStory(storyId: string): GameState {
    for (let i = 0; i < 60; i++) {
        const run = new RogueliteRun()
        const state = run.getState()
        const round = state.rounds[state.rounds.length - 1]
        const idx = round.choices.findIndex((c) => {
            const s = STORIES.find((st) => st.overrides[1] === c.id)
            return s?.id === storyId
        })
        if (idx >= 0) {
            run.selectChoice(idx)
            return run.getState()
        }
    }
    throw new Error(`60 次开局均未抽到故事 ${storyId}`)
}

/** 推进若干步直到当前轮出现给定类型的选项，返回 { state, choiceIndex }。 */
function advanceUntil(state: GameState, run: RogueliteRun, type: string): { state: GameState; choiceIndex: number } {
    let guard = 0
    let s = state
    while (guard++ < 40) {
        const round = s.rounds[s.rounds.length - 1]
        if (!round) break
        const idx = round.choices.findIndex((c) => c.type === type)
        if (idx >= 0) return { state: s, choiceIndex: idx }
        if (round.choices.length === 0) break
        run.selectChoice(0)
        s = run.getState()
    }
    throw new Error(`未找到 ${type} 类型选项`)
}

describe('修炼点动态配额', () => {
    it('need >= 机会数时强制给修炼点（快来不及了，不给 3 选 1）', () => {
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS - 3, 'action', 3)).toBe('points')
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS - 1, 'weapon', 1)).toBe('points')
    })

    it('未达上限、机会充足时按概率给修炼点（need/机会数）', () => {
        const rand = vi.spyOn(Math, 'random')
        // 差得远（need=16/25≈0.64）：随机值 0.5 < 0.64 → 给点
        rand.mockReturnValue(0.5)
        expect(resolveQuotaRewardType(10, 0, 'action', 25)).toBe('points')
        // 给多了（need=2/25=0.08）：随机值 0.5 > 0.08 → 给实体奖励
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS - 2, 'action', 25)).toBe('action')
        // 临界（need=10/20=0.5）：0.49 → 给点
        rand.mockReturnValue(0.49)
        expect(resolveQuotaRewardType(10, 6, 'action', 20)).toBe('points')
        rand.mockRestore()
    })

    it('已达 16 次硬上限后不再给修炼点', () => {
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS, 'action')).toBe('action')
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS, 'points')).toBe('passive')
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS, 'heal')).toBe('heal')
    })

    it('n2/n3 必为实体奖励（选武器/选招式）', () => {
        expect(resolveQuotaRewardType(2, 0, 'weapon')).toBe('weapon')
        expect(resolveQuotaRewardType(3, 0, 'action')).toBe('action')
        expect(resolveQuotaRewardType(3, MAX_POINTS_REWARDS, 'artifact')).toBe('artifact')
    })

    it('淘汰赛节点为无奖励', () => {
        expect(resolveQuotaRewardType(29, 0, 'points')).toBe('none')
        expect(resolveQuotaRewardType(33, 0, 'points')).toBe('none')
    })

    it('剧情感悟节点不给修炼点时降级为功法', () => {
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS, 'points')).toBe('passive')
    })

    it('机会数统计：地图上可发修炼点的节点 = 25（28 个奖励节点 − n2/n3 − 回忆事件）', () => {
        for (const s of STORIES) {
            const state = pickStory(s.id)
            const opportunities = countRewardOpportunities(state.nodes, 2)
            expect(opportunities, `${s.id} 的修炼点机会数不对`).toBe(25)
            // 回忆事件节点被排除在机会之外
            const memoryNode = state.nodes.findIndex((nd) => nd.eventIds?.includes('memory_within_memory')) + 1
            expect(memoryNode).toBeGreaterThan(0)
            expect(countRewardOpportunities(state.nodes, memoryNode)).toBe(
                countRewardOpportunities(state.nodes, memoryNode + 1),
            )
        }
    })
})

describe('淘汰赛无奖励', () => {
    it.each(['tournament_knockout_16', 'tournament_knockout_8', 'tournament_knockout_4', 'tournament_final'])(
        '%s 标记 noReward 且无奖励轮',
        (id) => {
            const ev = getEvent(id)!
            expect(ev.noReward).toBe(true)
            const matchRound = ev.rounds[0]
            expect(matchRound.choices).toHaveLength(1)
            expect(matchRound.choices[0].type).toBe('continue')
        },
    )

    it('小组赛事件有奖励轮', () => {
        for (const id of ['tournament_open', 'tournament_group_r1', 'tournament_group_r2', 'tournament_group_r3']) {
            const ev = getEvent(id)!
            expect(ev.noReward).toBeFalsy()
            expect(ev.rounds.some((r) => r.id === 'reward_round')).toBe(true)
        }
    })
})

describe('n2 武器 / n3 招式', () => {
    it('5 条线的 n2 都是选武器事件', () => {
        for (const s of STORIES) {
            const ev = getEvent(s.overrides[2])
            expect(ev?.rewardType, `${s.id} 的 n2 事件 ${s.overrides[2]} 不是武器奖励`).toBe('weapon')
        }
    })

    it('5 条线的 n3 都是实体奖励事件', () => {
        for (const s of STORIES) {
            const ev = getEvent(s.overrides[3])
            expect(['action', 'artifact', 'passive', 'weapon'], `${s.id} 的 n3 事件 ${s.overrides[3]} 不是实体奖励`).toContain(
                ev?.rewardType,
            )
        }
    })

    it('每件非御物起始武器至少有 3 个匹配的 2AP 招式', () => {
        const actions = rewardPool.getPool('action')
        for (const w of STARTING_WEAPONS) {
            if (w.tags.includes('imperial')) continue // 御物仅玄门，玄门 n3 为奇物
            const matches = actions.filter((a) => isWeaponBasicAction(a, w.tags))
            expect(matches.length, `${w.name}（${w.id}）匹配 2AP 招式不足 3`).toBeGreaterThanOrEqual(3)
        }
    })

    it('n3 出现的招式均为 2AP 且与所选武器 tags 关联', () => {
        for (let i = 0; i < 40; i++) {
            const run = new RogueliteRun()
            let state = run.getState()
            const pickRound = state.rounds[state.rounds.length - 1]
            const storyIdx = pickRound.choices.findIndex((c) => {
                const s = STORIES.find((st) => st.overrides[1] === c.id)
                return s !== undefined && ['wanderer', 'feud', 'sect', 'veteran'].includes(s.id)
            })
            if (storyIdx < 0) continue
            run.selectChoice(storyIdx)
            state = run.getState()

            // 推进到 n2 武器奖励轮，选一件武器
            let r = advanceUntil(state, run, 'weapon')
            const weaponChoice = r.state.rounds[r.state.rounds.length - 1].choices[r.choiceIndex]
            run.selectChoice(r.choiceIndex)
            state = run.getState()
            const weaponDef = STARTING_WEAPONS.find((w) => w.id === weaponChoice.id)!
            const weaponTags = weaponDef.tags

            // 推进到 n3 招式奖励轮
            r = advanceUntil(state, run, 'action')
            const actionChoices = r.state.rounds[r.state.rounds.length - 1].choices.filter((c) => c.type === 'action')
            expect(actionChoices.length).toBeGreaterThanOrEqual(3)
            for (const c of actionChoices) {
                const action = rewardPool.getPool('action').find((a) => a.id === c.id)
                expect(action).toBeDefined()
                if (action) {
                    expect(isWeaponBasicAction(action, weaponTags), `${c.id} 与武器 ${weaponChoice.id} 不匹配`).toBe(true)
                }
            }
            return
        }
        throw new Error('40 次开局未遇到可测故事')
    })

    it('n2 选赤手空拳 → +4 修炼点', () => {
        for (let i = 0; i < 60; i++) {
            const run = new RogueliteRun()
            let state = run.getState()
            const pickRound = state.rounds[state.rounds.length - 1]
            if (pickRound.choices.length === 0) continue
            run.selectChoice(0)
            state = run.getState()

            const r = advanceUntil(state, run, 'weapon')
            const round = r.state.rounds[r.state.rounds.length - 1]
            const bareIdx = round.choices.findIndex((c) => c.id === 'bare_hands')
            if (bareIdx < 0) continue

            const before = r.state.unspentPoints
            run.selectChoice(bareIdx)
            state = run.getState()
            expect(state.unspentPoints - before).toBe(4)
            expect(state.build.rewards.some((x) => x.id === 'bare_hands')).toBe(true)
            return
        }
        throw new Error('60 次开局 n2 均未出现赤手空拳选项')
    })
})

describe('天工坊', () => {
    it('不出起始武器，也不出御物', () => {
        const pool = rewardPool.getPool('weapon')
        const eligible = pool.filter((w) => TIANGONG_WEAPON.rewardFilter!(w))
        expect(eligible.length).toBeGreaterThan(5)
        for (const w of eligible) {
            expect(STARTING_WEAPONS.some((s) => s.id === w.id), `${w.id} 是起始武器`).toBe(false)
            expect(w.tags.includes('imperial'), `${w.id} 是御物`).toBe(false)
        }
    })
})

describe('漱玉峰瀑布顿悟', () => {
    it('只出 4AP/5AP 招式', () => {
        const pool = rewardPool.getPool('action')
        const eligible = pool.filter((a) => WATERFALL_EPIPHANY.rewardFilter!(a))
        expect(eligible.length).toBeGreaterThanOrEqual(3)
        for (const a of eligible) {
            expect('apCost' in a && a.apCost >= 4).toBe(true)
        }
    })
})

describe('回忆中的回忆', () => {
    it('固定三选一固有功法（独臂/凝炁诀/平平无奇的锻炼）', () => {
        const rewardRound = MEMORY_WITHIN_MEMORY.rounds.find((r) => r.id === 'reward_round')!
        const ids = rewardRound.choices.map((c) => c.id)
        expect(ids).toEqual(['one_arm', 'ningqi_jue', 'ordinary_training'])
        for (const c of rewardRound.choices) {
            expect(c.type).toBe('passive')
        }
    })

    it('固有功法被排除出普通奖励池（仅回忆事件可获得）', () => {
        const pool = rewardPool.getPool('passive')
        const ids = pool.map((p) => p.id)
        for (const id of ['one_arm', 'ningqi_jue', 'ordinary_training']) {
            expect(ids).not.toContain(id)
        }
    })
})

describe('n1 出身选择', () => {
    it('选项为各故事的出身事件（overrides[1]），文案场景化、不用故事线名', () => {
        const run = new RogueliteRun()
        const state = run.getState()
        const pickRound = state.rounds[state.rounds.length - 1]
        expect(pickRound.title).toBe('你从哪里来')
        expect(pickRound.choices.length).toBeGreaterThan(0)
        for (const c of pickRound.choices) {
            const story = STORIES.find((s) => s.overrides[1] === c.id)
            expect(story, `选项 ${c.id} 没有对应的故事`).toBeDefined()
            if (story) {
                const originEv = getEvent(c.id)
                expect(originEv, `${c.id} 不是已注册事件`).toBeDefined()
                expect(c.type).toBe('event')
                expect(c.label).toBe(originEv?.name)
                expect(c.label).not.toBe(story.name)
            }
        }
    })

    it('选出身 → 进入出身事件 → 结算开局奖励 → 进入 n2', () => {
        for (let i = 0; i < 40; i++) {
            const run = new RogueliteRun()
            let state = run.getState()
            const pickRound = state.rounds[state.rounds.length - 1]
            if (pickRound.choices.length === 0) continue
            // 选第一个出身选项（type 'event'）
            const eventIdx = pickRound.choices.findIndex((c) => c.type === 'event')
            if (eventIdx < 0) continue
            const originId = pickRound.choices[eventIdx].id
            run.selectChoice(eventIdx)
            state = run.getState()
            // 应该进入出身事件（n1 未结束）
            expect(state.nodeIndex).toBe(1)
            expect(state.build.story).toBeDefined()
            expect(getEvent(originId)).toBeDefined()
            // 推进出身事件 → 奖励轮 → n2
            let guard = 0
            while (state.nodeIndex === 1 && guard++ < 20) {
                const round = state.rounds[state.rounds.length - 1]
                if (!round || round.choices.length === 0) break
                run.selectChoice(0)
                state = run.getState()
            }
            expect(state.nodeIndex).toBe(2)
            return
        }
        throw new Error('40 次开局均未进入出身事件')
    })
})

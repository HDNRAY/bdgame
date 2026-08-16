import { describe, it, expect, vi } from 'vitest'
import { RogueliteRun } from '../roguelite/engine'
import type { GameState } from '../entities/state'
import { getEvent, ALL_EVENTS } from '../../data/events/index'
import { STORIES } from '../../data/stories/index'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { rewardPool } from '../roguelite/reward-pool'
import { isWeaponBasicAction, resolveQuotaRewardType, countRewardOpportunities, NO_REWARD_NODES } from '../roguelite/util'
import { MAX_POINTS_REWARDS } from '../entities/reward'
import { TIANGONG_WEAPON, MEMORY_WITHIN_MEMORY, WATERFALL_EPIPHANY } from '../../data/events/branch'
import { buildNodeSpecs } from '../roguelite/map-builder'
import { evaluateWhen } from '../entities/condition'

/** 开一局，反复抽出身直到出现指定故事，选中后返回状态（故事 flag 已激活）。 */
function pickStory(storyId: string): GameState {
    for (let i = 0; i < 60; i++) {
        const run = new RogueliteRun()
        const state = run.getState()
        const round = state.rounds[state.rounds.length - 1]
        const idx = round.choices.findIndex((c) => {
            const s = STORIES.find((st) => st.originEventId === c.id)
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

/** 找某故事线在指定节点的固定事件（placement nodes 命中且 when 指向该故事）。 */
function storyNodeEventId(storyId: string, node: number): string | undefined {
    return ALL_EVENTS.find((ev) => {
        if (!ev.placement) return false
        return ev.placement.some(
            (p) =>
                p.nodes?.includes(node) &&
                JSON.stringify(p.when) === JSON.stringify({ '==': [{ var: 'flags.story' }, storyId] }),
        )
    })?.id
}

describe('修炼点动态配额', () => {
    it('need >= 机会数时强制给修炼点（快来不及了，不给 3 选 1）', () => {
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS - 3, 3)).toBe('points')
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS - 1, 1)).toBe('points')
    })

    it('未达上限、机会充足时按概率给修炼点（need/机会数）', () => {
        const rand = vi.spyOn(Math, 'random')
        rand.mockReturnValue(0.5)
        expect(resolveQuotaRewardType(10, 0, 25)).toBe('points') // need=16/25≈0.64 > 0.5
        rand.mockReturnValue(0.9)
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS - 2, 25)).toBe('item') // need=2/25≈0.08 < 0.9
        rand.mockRestore()
    })

    it('已达 16 次硬上限后不再给修炼点', () => {
        expect(resolveQuotaRewardType(10, MAX_POINTS_REWARDS, 25)).toBe('item')
    })

    it('n2/n3 必为实体奖励（选武器/选招式）', () => {
        expect(resolveQuotaRewardType(2, 0, 25)).toBe('item')
        expect(resolveQuotaRewardType(3, 0, 25)).toBe('item')
    })

    it('淘汰赛节点为无奖励', () => {
        for (const n of NO_REWARD_NODES) {
            expect(resolveQuotaRewardType(n, 0, 25)).toBe('none')
        }
    })

    it('机会数统计：地图上可发修炼点的节点槽 = 26（32 − 淘汰赛 4 − n2/n3）', () => {
        for (const s of STORIES) {
            const state = pickStory(s.id)
            expect(countRewardOpportunities(state.nodes, 2), `${s.id} 的机会数不对`).toBe(26)
        }
    })
})

describe('淘汰赛无奖励', () => {
    it.each(['tournament_knockout_16', 'tournament_knockout_8', 'tournament_knockout_4', 'tournament_final'])(
        '%s 奖励为 none 且无奖励轮',
        (id) => {
            const ev = getEvent(id)!
            expect(ev.reward?.kind).toBe('none')
            const matchRound = ev.rounds[0]
            expect(matchRound.choices).toHaveLength(1)
            expect(matchRound.choices[0].type).toBe('continue')
        },
    )

    it('小组赛事件有奖励轮', () => {
        for (const id of ['tournament_open', 'tournament_group_r1', 'tournament_group_r2', 'tournament_group_r3']) {
            const ev = getEvent(id)!
            expect(ev.reward?.kind).not.toBe('none')
            expect(ev.rounds.some((r) => r.id === 'reward_round')).toBe(true)
        }
    })
})

describe('n2 武器 / n3 招式', () => {
    it('5 条线的 n2 都是选武器事件（含空手→修炼点；玄门为固定御物三选一）', () => {
        for (const s of STORIES) {
            const evId = storyNodeEventId(s.id, 2)
            const ev = getEvent(evId ?? '')
            if (s.id === 'xuanmen') {
                // 玄门：固定御物三选一（显式轮次选择）
                const rewardRound = ev?.rounds.find((r) => r.id === 'reward_round')
                const weaponChoices = (rewardRound?.choices ?? []).filter((c) => c.type === 'weapon')
                expect(weaponChoices.length, `${s.id} 的 n2 御物不足`).toBe(3)
            } else {
                expect(ev?.reward?.kind, `${s.id} 的 n2 事件 ${evId} 不是固定武器选择`).toBe('fixed')
                const labels = (ev?.reward?.kind === 'fixed' ? ev.reward.choices : []).map((c) => c.id)
                expect(labels).toContain('bare_hands')
                expect(labels).toContain('peach_sword')
            }
        }
    })

    it('5 条线的 n3 都是实体奖励事件', () => {
        for (const s of STORIES) {
            const evId = storyNodeEventId(s.id, 3)
            const ev = getEvent(evId ?? '')
            const kind = ev?.reward?.kind
            expect(['item', 'fixed'], `${s.id} 的 n3 事件 ${evId} 不是实体奖励`).toContain(kind)
        }
    })

    it('每件非御物起始武器至少有 3 个匹配的 2AP 招式', () => {
        const actions = rewardPool.getPool('action')
        for (const w of STARTING_WEAPONS) {
            if (w.tags.includes('imperial')) continue
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
                const s = STORIES.find((st) => st.originEventId === c.id)
                return s !== undefined && ['wanderer', 'feud', 'sect', 'veteran'].includes(s.id)
            })
            if (storyIdx < 0) continue
            run.selectChoice(storyIdx)
            state = run.getState()

            // 推进到 n2 武器奖励轮，选一件武器
            let r = advanceUntil(state, run, 'weapon')
            const weaponRound = r.state.rounds[r.state.rounds.length - 1]
            const weaponChoice = weaponRound.choices.find((c) => c.type === 'weapon')!
            run.selectChoice(weaponRound.choices.indexOf(weaponChoice))
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

    it('n2 选赤手空拳 → +4 修炼点（空手不算武器）', () => {
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
            return
        }
        throw new Error('60 次开局 n2 均未出现赤手空拳选项')
    })
})

describe('天工坊', () => {
    it('只出坊中名器：排除起始武器，且不出御物（御物池本身已排除）', () => {
        const spec = TIANGONG_WEAPON.reward
        expect(spec?.kind).toBe('item')
        if (spec?.kind === 'item') {
            expect(spec.pool).toBe('weapon')
            for (const w of STARTING_WEAPONS) {
                expect(spec.excludeIds, `${w.id} 应被天工坊排除`).toContain(w.id)
            }
        }
        const pool = rewardPool.getPool('weapon')
        expect(pool.every((w) => !w.tags.includes('imperial'))).toBe(true)
    })
})

describe('漱玉峰瀑布顿悟', () => {
    it('只出 4AP/5AP 招式', () => {
        const spec = WATERFALL_EPIPHANY.reward
        expect(spec?.kind).toBe('item')
        if (spec?.kind === 'item') {
            expect(spec.apMin).toBe(4)
            const pool = rewardPool.getPool('action').filter((a) => 'apCost' in a && a.apCost >= 4)
            expect(pool.length).toBeGreaterThanOrEqual(3)
        }
    })
})

describe('打工事件（特殊固定奖励）', () => {
    it('图书馆打工 → 活武学宝典；天工坊打工 → 千锤百炼', () => {
        const lib = getEvent('library_job')!
        const tg = getEvent('tiangong_job')!
        expect(lib.rounds.find((r) => r.id === 'reward_round')!.choices.map((c) => c.id)).toEqual([
            'martial_arts_archive',
        ])
        expect(tg.rounds.find((r) => r.id === 'reward_round')!.choices.map((c) => c.id)).toEqual([
            'qian_chui_bai_lian',
        ])
    })

    it('两个固有功法被排除出普通奖励池（仅打工事件可获得）', () => {
        const ids = rewardPool.getPool('passive').map((p) => p.id)
        expect(ids).not.toContain('martial_arts_archive')
        expect(ids).not.toContain('qian_chui_bai_lian')
    })

    it('活武学宝典不再属于 xiaohua 固定奖励', () => {
        const ev = getEvent('xiaohua_insight')!
        if (ev.reward?.kind === 'item') {
            expect(ev.reward.ids).not.toContain('martial_arts_archive')
        }
    })
})

describe('回忆中的回忆', () => {
    it('固定三选一固有功法（独臂/药屋旁支·凝炁诀/周家后人·周氏秘法）', () => {
        const rewardRound = MEMORY_WITHIN_MEMORY.rounds.find((r) => r.id === 'reward_round')!
        const ids = rewardRound.choices.map((c) => c.id)
        expect(ids).toEqual(['one_arm', 'ningqi_jue', 'zoldyck_art'])
        for (const c of rewardRound.choices) {
            expect(c.type).toBe('passive')
        }
        // 药屋旁支（凝炁诀）在玄门故事不出现
        const ningqi = rewardRound.choices.find((c) => c.id === 'ningqi_jue')!
        expect(ningqi.when).toBeDefined()
    })

    it('玄门故事下药屋旁支选项被过滤掉', () => {
        const run = new RogueliteRun()
        let state = run.getState()
        // 选玄门出身
        const pickRound = state.rounds[state.rounds.length - 1]
        const xuanIdx = pickRound.choices.findIndex((c) => {
            const s = STORIES.find((st) => st.originEventId === c.id)
            return s?.id === 'xuanmen'
        })
        if (xuanIdx < 0) return // 本局未抽到玄门则跳过（非玄门线不受影响）
        run.selectChoice(xuanIdx)
        state = run.getState()
        // 手动构造：玄门故事下，回忆事件的奖励轮中不应出现凝炁诀
        const rewardRound = MEMORY_WITHIN_MEMORY.rounds.find((r) => r.id === 'reward_round')!
        const visible = rewardRound.choices.filter((c) => {
            if (!c.when) return true
            return evaluateWhen(c.when, { flags: state.flags })
        })
        expect(visible.some((c) => c.id === 'ningqi_jue')).toBe(false)
        expect(visible.map((c) => c.id)).toEqual(['one_arm', 'zoldyck_art'])
    })

    it('固有功法被排除出普通奖励池（仅回忆事件可获得）', () => {
        const pool = rewardPool.getPool('passive')
        const ids = pool.map((p) => p.id)
        for (const id of ['one_arm', 'ningqi_jue', 'zoldyck_art']) {
            expect(ids).not.toContain(id)
        }
    })
})

describe('喝酒结拜链（两段式 flag 门控）', () => {
    function swornCandidate(nodeIndex: number) {
        const specs = buildNodeSpecs(ALL_EVENTS)
        return specs[nodeIndex - 1].candidates.find((c) => c.eventId === 'chronicle_sworn_brothers')
    }

    it('喝酒结拜事件挂 got_wine 条件：未得酒被过滤，得酒后通过', () => {
        const candidate = swornCandidate(16)
        expect(candidate).toBeDefined()
        expect(evaluateWhen(candidate!.when, { flags: {} })).toBe(false)
        expect(evaluateWhen(candidate!.when, { flags: { got_wine: true } })).toBe(true)
    })

    it('喝酒结拜的奖励限定酒系功法', () => {
        const ev = getEvent('chronicle_sworn_brothers')!
        if (ev.reward?.kind === 'item') {
            expect(ev.reward.includeTags).toContain('jiu')
        }
    })
})

describe('四支线链与天工坊两段（flag 门控，顺序一致）', () => {
    function cand(node: number, id: string) {
        const specs = buildNodeSpecs(ALL_EVENTS)
        return specs[node - 1].candidates.find((c) => c.eventId === id)
    }

    it('酒馆偶遇 → 结拜 → 青山论剑 → 酒吧杀人 → 归海楼（顺序强制）', () => {
        const enc = cand(13, 'chronicle_tavern_encounter')!
        expect(enc).toBeDefined()
        expect(evaluateWhen(enc.when, { flags: {} })).toBe(true) // 链首，无前置
        expect(evaluateWhen(enc.when, { flags: { got_wine: true } })).toBe(false) // 已得酒 → 不再出

        const sworn = cand(13, 'chronicle_sworn_brothers')!
        expect(evaluateWhen(sworn.when, { flags: { got_wine: true } })).toBe(true)
        expect(evaluateWhen(sworn.when, { flags: {} })).toBe(false)

        // 青山论剑排在酒吧杀人之前（奇遇流里六绝观战=与陶朵重逢的笔墨）
        const six = cand(14, 'chronicle_six_duel')!
        expect(evaluateWhen(six.when, { flags: { sworn_done: true, story: 'feud' } })).toBe(true)
        expect(evaluateWhen(six.when, { flags: {} })).toBe(false) // 没结拜 → 青山论剑不出
        expect(evaluateWhen(six.when, { flags: { sworn_done: true, story: 'wanderer' } })).toBe(false) // 奇遇流走主线版

        const bar = cand(14, 'chronicle_bar_killing')!
        expect(evaluateWhen(bar.when, { flags: { six_done: true, story: 'feud' } })).toBe(true)
        expect(evaluateWhen(bar.when, { flags: { sworn_done: true, story: 'feud' } })).toBe(false) // 需先过青山论剑
        expect(evaluateWhen(bar.when, { flags: {} })).toBe(false) // 没观六绝 → 酒吧杀人不出
    })

    it('归海楼在酒吧杀人之后解锁', () => {
        expect(evaluateWhen(cand(15, 'chronicle_guihailou')!.when, { flags: { bar_done: true } })).toBe(true)
        expect(evaluateWhen(cand(15, 'chronicle_guihailou')!.when, { flags: { six_done: true } })).toBe(false)
    })

    it('天工坊第一次在第一阶段末；第二次（副手）需先去天工坊+单手+未选独臂', () => {
        const t1 = cand(9, 'tiangong_weapon')!
        expect(t1).toBeDefined()
        expect(evaluateWhen(t1.when, { flags: {} })).toBe(true)
        expect(evaluateWhen(t1.when, { flags: { tiangong_done: true } })).toBe(false)

        const t2 = cand(24, 'tiangong_offhand')!
        expect(t2).toBeDefined()
        expect(evaluateWhen(t2.when, { flags: { tiangong_done: true, weapon_one_handed: true } })).toBe(true)
        expect(evaluateWhen(t2.when, { flags: { tiangong_done: true, weapon_one_handed: true, one_arm: true } })).toBe(false)
        expect(evaluateWhen(t2.when, { flags: { weapon_one_handed: true } })).toBe(false) // 没去过天工坊
        expect(evaluateWhen(t2.when, { flags: { tiangong_done: true } })).toBe(false) // 不是单手
    })
})

describe('n1 出身选择', () => {
    it('选项为各故事的出身事件，文案场景化、不用故事线名', () => {
        const run = new RogueliteRun()
        const state = run.getState()
        const pickRound = state.rounds[state.rounds.length - 1]
        expect(pickRound.title).toBe('你从哪里来')
        expect(pickRound.choices.length).toBeGreaterThan(0)
        for (const c of pickRound.choices) {
            const story = STORIES.find((s) => s.originEventId === c.id)
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

    it('选出身 → 激活故事 flag → 出身事件 → 进入 n2', () => {
        for (let i = 0; i < 40; i++) {
            const run = new RogueliteRun()
            let state = run.getState()
            const pickRound = state.rounds[state.rounds.length - 1]
            if (pickRound.choices.length === 0) continue
            const eventIdx = pickRound.choices.findIndex((c) => c.type === 'event')
            if (eventIdx < 0) continue
            run.selectChoice(eventIdx)
            state = run.getState()
            // 故事 flag 已激活
            expect(state.flags['story']).toBeDefined()
            // 出身事件进行中（n1 未结束）
            expect(state.nodeIndex).toBe(1)
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

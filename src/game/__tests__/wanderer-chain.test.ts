import { describe, it, expect } from 'vitest'
import { evaluateWhen } from '../entities/condition'
import { buildNodeSpecs, resolveNode } from '../roguelite/map-builder'
import { ALL_EVENTS, getEvent } from '../../data/events/index'
import { CHANZI_MEDITATION } from '../../data/events/chanzi'

const specs = buildNodeSpecs(ALL_EVENTS)

/** 取某个事件在节点上的候选 */
function candidateAt(eventId: string, index: number) {
    return specs[index].candidates.find((c) => c.eventId === eventId)
}

describe('奇遇流主线链（第二阶段必遇）', () => {
    const wanderer = (
        extra: Record<string, string | number | boolean> = {},
    ): { flags: Record<string, string | number | boolean> } => ({
        flags: { story: 'wanderer', ...extra },
    })

    it('n12 必遇来风结拜（非 fallback，直接开始）', () => {
        const res = resolveNode(specs[11], wanderer().flags)
        expect(res.mode).toBe('direct')
        if (res.mode === 'direct') expect(res.eventId).toBe('wanderer_sworn')
        // 写 got_wine + sworn_done
        expect(getEvent('wanderer_sworn')?.effects).toEqual([{ kind: 'setMany', flags: { got_wine: true, sworn_done: true } }])
    })

    it('n14 青山之巅·六绝（与陶朵重逢同往观战，sworn_done 门控）', () => {
        expect(resolveNode(specs[13], wanderer().flags).mode).toBe('choice') // 未结拜 → 池候选
        const res = resolveNode(specs[13], wanderer({ sworn_done: true }).flags)
        expect(res.mode).toBe('direct')
        if (res.mode === 'direct') expect(res.eventId).toBe('wanderer_six_duel')
        expect(getEvent('wanderer_six_duel')?.effects).toEqual([{ kind: 'set', flag: 'six_done', to: true }])
    })

    it('n16 酒吧杀人（six_done 门控，非 fallback）', () => {
        expect(resolveNode(specs[15], wanderer({ sworn_done: true }).flags).mode).toBe('choice') // 未观六绝 → 池候选
        const res = resolveNode(specs[15], wanderer({ sworn_done: true, six_done: true }).flags)
        expect(res.mode).toBe('direct')
        if (res.mode === 'direct') expect(res.eventId).toBe('wanderer_bar')
        expect(getEvent('wanderer_bar')?.effects).toEqual([{ kind: 'set', flag: 'bar_done', to: true }])
    })

    it('n18 恩师问话（bar_done 门控）', () => {
        const res = resolveNode(specs[17], wanderer({ sworn_done: true, six_done: true, bar_done: true }).flags)
        expect(res.mode).toBe('direct')
        if (res.mode === 'direct') expect(res.eventId).toBe('wanderer_yanglong')
    })

    it('n20 来风报信（yanglong_done 门控）', () => {
        const res = resolveNode(
            specs[19],
            wanderer({ sworn_done: true, six_done: true, bar_done: true, yanglong_done: true }).flags,
        )
        expect(res.mode).toBe('direct')
        if (res.mode === 'direct') expect(res.eventId).toBe('wanderer_register')
    })

    it('主线写同样的 flag 后，共享链的偶遇/结拜/青山论剑/酒吧杀人不再对奇遇流出现', () => {
        // 共享青山论剑/酒吧杀人：奇遇流被显式排除；其他线按链序解锁（青山论剑在前，酒吧杀人需要 six_done）
        const six = getEvent('chronicle_six_duel')
        const bar = getEvent('chronicle_bar_killing')
        expect(six?.placement?.[0]?.when).toBeDefined()
        expect(bar?.placement?.[0]?.when).toBeDefined()
        for (const story of ['wanderer']) {
            expect(evaluateWhen(six?.placement?.[0]?.when, { flags: { story, sworn_done: true } })).toBe(false)
            expect(evaluateWhen(bar?.placement?.[0]?.when, { flags: { story, six_done: true } })).toBe(false)
        }
        // 其他线：青山论剑在结拜后解锁（sworn_done），酒吧杀人需先过青山论剑（six_done）
        expect(evaluateWhen(six?.placement?.[0]?.when, { flags: { story: 'feud', sworn_done: true } })).toBe(true)
        expect(evaluateWhen(six?.placement?.[0]?.when, { flags: { story: 'feud' } })).toBe(false)
        expect(evaluateWhen(bar?.placement?.[0]?.when, { flags: { story: 'feud', six_done: true } })).toBe(true)
        expect(evaluateWhen(bar?.placement?.[0]?.when, { flags: { story: 'feud', sworn_done: true } })).toBe(false)
        // 归海楼在酒吧杀人后解锁
        const guihailou = getEvent('chronicle_guihailou')
        expect(evaluateWhen(guihailou?.placement?.[0]?.when, { flags: { story: 'feud', bar_done: true } })).toBe(true)
        // 偶遇/结拜：flag 已写 → when 不满足
        const tavern = getEvent('chronicle_tavern_encounter')?.placement?.[0]?.when
        const sworn = getEvent('chronicle_sworn_brothers')?.placement?.[0]?.when
        expect(evaluateWhen(tavern, { flags: { story: 'wanderer', got_wine: true } })).toBe(false)
        expect(evaluateWhen(sworn, { flags: { story: 'wanderer', got_wine: true, sworn_done: true } })).toBe(false)
    })
})

describe('血海深仇 n12 加入调查科', () => {
    it('n12 非 fallback 主线：加入调查科（feud 专属）', () => {
        const res = resolveNode(specs[11], { story: 'feud' })
        expect(res.mode).toBe('direct')
        if (res.mode === 'direct') expect(res.eventId).toBe('feud_join_detectives')
        // 其他故事线：n12 无血海专属事件 → 池候选，且不会抽到加入调查科
        const resSect = resolveNode(specs[11], { story: 'sect' })
        expect(resSect.mode).toBe('choice')
        if (resSect.mode === 'choice') {
            expect(resSect.options.map((o) => o.eventId)).not.toContain('feud_join_detectives')
        }
        // 旧的白山月试炼已移除
        expect(getEvent('feud_hongti_spar')).toBeUndefined()
    })
})

describe('归海楼研讨会（天生道种/玄门主线）', () => {
    it('道种 n14 与桑原切磋、n15 表演赛（非 fallback 直接开始）', () => {
        const res14 = resolveNode(specs[13], { story: 'sect' })
        expect(res14.mode).toBe('direct')
        if (res14.mode === 'direct') expect(res14.eventId).toBe('sect_guihailou_arrive')
        expect(getEvent('sect_guihailou_arrive')?.effects).toEqual([{ kind: 'set', flag: 'guihailou_done', to: true }])

        const res15 = resolveNode(specs[14], { story: 'sect' })
        expect(res15.mode).toBe('direct')
        if (res15.mode === 'direct') expect(res15.eventId).toBe('sect_guihailou_show')
    })

    it('玄门 n14 归海楼参会（n15 小树在归海楼重逢）', () => {
        const res14 = resolveNode(specs[13], { story: 'xuanmen' })
        expect(res14.mode).toBe('direct')
        if (res14.mode === 'direct') expect(res14.eventId).toBe('xuanmen_guihailou')
        expect(getEvent('xuanmen_guihailou')?.effects).toEqual([{ kind: 'set', flag: 'guihailou_done', to: true }])
        const res15 = resolveNode(specs[14], { story: 'xuanmen' })
        expect(res15.mode).toBe('direct')
        if (res15.mode === 'direct') expect(res15.eventId).toBe('xuanmen_n15_heishu')
    })

    it('共享池版归海楼为道种/玄门让位，其他线正常', () => {
        const when = getEvent('chronicle_guihailou')?.placement?.[0]?.when
        expect(when).toBeDefined()
        expect(evaluateWhen(when, { flags: { bar_done: true, story: 'sect' } })).toBe(false)
        expect(evaluateWhen(when, { flags: { bar_done: true, story: 'xuanmen' } })).toBe(false)
        expect(evaluateWhen(when, { flags: { bar_done: true, story: 'veteran' } })).toBe(true)
    })
})

describe('一阶段中段（n4-7）渲染池', () => {
    const renderEvents: { story: string; ids: string[] }[] = [
        { story: 'feud', ids: ['feud_render_manor', 'feud_render_qinggong', 'feud_render_baishan'] },
        { story: 'sect', ids: ['sect_render_shixiong', 'sect_render_layue', 'sect_render_men'] },
        { story: 'xuanmen', ids: ['xuanmen_render_twins', 'xuanmen_render_yuwu', 'xuanmen_render_zuxun'] },
        { story: 'wanderer', ids: ['wanderer_render_lane', 'wanderer_render_gone', 'wanderer_render_qilan'] },
        { story: 'veteran', ids: ['veteran_render_laochai'] },
    ]

    for (const { story, ids } of renderEvents) {
        it(`${story} 的渲染事件是 fallback 候选，且只对本故事线存活`, () => {
            const indices = story === 'veteran' ? [6] : [3, 4, 5, 6] // 军旅 n4-6 被主线占据，只在 n7
            for (const i of indices) {
                for (const id of ids) {
                    const c = candidateAt(id, i)
                    expect(c, `${id}@${i + 1}`).toBeDefined()
                    expect(c?.fallback).toBe(true)
                    expect(evaluateWhen(c?.when, { flags: { story } })).toBe(true)
                    // 其他故事线不存活
                    expect(evaluateWhen(c?.when, { flags: { story: story === 'feud' ? 'sect' : 'feud' } })).toBe(false)
                }
            }
        })
    }

    it('军旅渲染事件只在 n7（n4-6 被主线占据）', () => {
        expect(candidateAt('veteran_render_laochai', 6)).toBeDefined() // node 7
        for (let i = 3; i <= 5; i++) {
            expect(candidateAt('veteran_render_laochai', i)).toBeUndefined() // node 4-6
        }
    })

    it('渲染事件每局至多一次（done flag 门控）', () => {
        const c = candidateAt('feud_render_manor', 3)
        expect(evaluateWhen(c?.when, { flags: { story: 'feud' } })).toBe(true)
        expect(evaluateWhen(c?.when, { flags: { story: 'feud', feud_render_manor_done: true } })).toBe(false)
    })
})

describe('回忆中的回忆 → 第一阶段中段', () => {
    it('候选在 n4-7（fallback，memory_done 门控），n8+ 不再出现', () => {
        for (let i = 3; i <= 6; i++) {
            const c = candidateAt('memory_within_memory', i)
            expect(c).toBeDefined()
            expect(c?.fallback).toBe(true)
            expect(evaluateWhen(c?.when, { flags: {} })).toBe(true)
        }
        // 天工坊 n8-10 之前；n11 起不再有候选
        expect(candidateAt('memory_within_memory', 7)).toBeUndefined()
        expect(candidateAt('memory_within_memory', 11)).toBeUndefined()
        // done 后不再出现
        expect(evaluateWhen(candidateAt('memory_within_memory', 3)?.when, { flags: { memory_done: true } })).toBe(false)
    })
})

describe('多林寺问禅（禅子）', () => {
    const branchChoices = () => {
        const round = CHANZI_MEDITATION.rounds.find((r) => r.id === 'branch')
        return round ? round.choices : []
    }

    it('结拜过 → 禅子以来风故人相待，给静心功法（明镜止水）', () => {
        const choices = branchChoices().filter((c) => evaluateWhen(c.when, { flags: { sworn_done: true } }))
        expect(choices.map((c) => c.id)).toEqual(['sworn_reward'])
        const rewardRound = CHANZI_MEDITATION.rounds.find((r) => r.id === 'sworn_reward')
        expect(rewardRound?.reward).toEqual({ kind: 'item', pool: 'passive', ids: ['mingjing_zhishui'] })
    })

    it('血海深仇线（未结拜）→ 竹子同事的对话 → 招式', () => {
        const choices = branchChoices().filter((c) => evaluateWhen(c.when, { flags: { story: 'feud' } }))
        expect(choices.map((c) => c.id)).toEqual(['feud_reward'])
        const rewardRound = CHANZI_MEDITATION.rounds.find((r) => r.id === 'feud_reward')
        expect(rewardRound?.reward).toMatchObject({ kind: 'item', pool: 'action' })
    })

    it('其余 → 普通问禅 → 招式', () => {
        const choices = branchChoices().filter((c) => evaluateWhen(c.when, { flags: {} }))
        expect(choices.map((c) => c.id)).toEqual(['default_reward'])
        const rewardRound = CHANZI_MEDITATION.rounds.find((r) => r.id === 'default_reward')
        expect(rewardRound?.reward).toMatchObject({ kind: 'item', pool: 'action' })
    })

    it('三个分支互斥：任何旗标组合下恰好一个可见', () => {
        const cases: Record<string, string | number | boolean>[] = [
            {},
            { sworn_done: true },
            { story: 'feud' },
            { story: 'feud', sworn_done: true },
            { story: 'sect' },
            { story: 'sect', sworn_done: true },
        ]
        for (const flags of cases) {
            const visible = branchChoices().filter((c) => evaluateWhen(c.when, { flags }))
            expect(visible, JSON.stringify(flags)).toHaveLength(1)
        }
    })
})

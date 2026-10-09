import { describe, it, expect } from 'vitest'
import { ALL_EVENTS, getEvent } from '../../data/events/index'
import { END_EVENT } from '../entities/round'

// ════════════════════════════════════════
//  事件轮次接线审计
//
//  引擎按 choice.id 找下一个轮次（`_jumpToRound` → findIndex）。指向不存在的 id 时，
//  引擎只打一行 console.error 就把事件结束掉 —— 玩家侧表现为「点了没反应，或事件莫名走完」。
//  这类数据 bug 没有任何编译期保护，所以在这里按全集扫一遍。
//
//  另：玄门 n14「归海楼·参会」的文案与 `docs/stories/view-stories/xuanmen.md` n15 都写明
//  代表玄门出战、与桑原切磋，数据里一度没有这场战斗；下面把这条接线钉住。
// ════════════════════════════════════════

describe('事件轮次接线', () => {
    it('每个 continue 选项都指向本事件里存在的轮次（__end__ 除外）', () => {
        const dangling: string[] = []
        for (const ev of ALL_EVENTS) {
            const roundIds = new Set((ev.rounds ?? []).map((r) => r.id))
            for (const round of ev.rounds ?? []) {
                for (const choice of round.choices) {
                    if (choice.type !== 'continue') continue
                    if (choice.id === END_EVENT) continue
                    if (!roundIds.has(choice.id)) {
                        dangling.push(`${ev.id}: ${round.id} -> ${choice.id}`)
                    }
                }
            }
        }
        expect(dangling).toEqual([])
    })

    it('玄门 n14 归海楼：下场即与桑原切磋（固定战斗），胜/负后同走奖励轮', () => {
        const ev = getEvent('xuanmen_guihailou')!
        const arrive = ev.rounds.find((r) => r.id === 'arrive')!
        expect(arrive.choices.map((c) => c.id)).toEqual(['combat_round'])

        const combat = ev.rounds.find((r) => r.id === 'combat_round')!
        expect(combat.enemyId).toBe('sangyuan')
        expect(combat.choices.map((c) => c.id)).toEqual(['reward_round'])
    })
})

describe('斗炁大会小组赛编号与 n28 出线结算', () => {
    // 三场真实小组赛在 n23（r0）/ n26（r1）/ n27（r2）；n28（r3）只出线结算、没有战斗。
    // 旧数据把 n26/n27 的序号写成「第一场/第二场」，n28 还挂着「踏入擂台」的开打口吻。
    it('n26/n27 的序号与实际场次对齐（n23 的小组赛 r0 才是第一场）', () => {
        const r1 = getEvent('tournament_group_r1')!
        const r2 = getEvent('tournament_group_r2')!
        expect(r1.name).toBe('小组赛·第二轮')
        expect(r1.description).toContain('第二场')
        expect(r2.name).toBe('小组赛·第三轮')
        expect(r2.description).toContain('第三场')
    })

    it('n28 是出线结算：选项不是开打口吻，奖励轮也不叫「战利品」', () => {
        const ev = getEvent('tournament_group_r3')!
        const first = ev.rounds[0]
        expect(first.choices.map((c) => c.label)).toEqual(['去看对阵'])
        // 「最后一场/打完才知道」属于 n27 那场真实战斗，不该挂在结算节点上
        expect(ev.description).not.toContain('最后一场')
        expect(ev.rounds.some((r) => r.title === '战利品')).toBe(false)
    })
})

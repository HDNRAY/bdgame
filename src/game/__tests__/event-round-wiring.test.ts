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

import { describe, it, expect } from 'vitest'
import { getBuff, SWORD_DOMINION_CAP } from '../../data/buffs'
import { getAction } from '../../data/actions'

const buff = getBuff('sword_dominion')!

/** 直接调钩子：onDealDamage 的返回即本层的增伤结果（引擎按 final 链式传递） */
function hit(final: number, source: ReturnType<typeof getAction>): number {
    const out = buff.onDealDamage!({ final, raw: final, source } as never)
    if (typeof out !== 'number') throw new Error('御剑诀 onDealDamage 应返回数值')
    return out
}

describe('御剑诀 · 增伤封顶', () => {
    it('定义齐全（功法挂上 buff，且延长射程）', () => {
        expect(getBuff('sword_dominion')).toBeDefined()
        expect(buff.onRuntimeAction).toBeTypeOf('function')
        expect(buff.onDealDamage).toBeTypeOf('function')
    })

    // 期望值从数据的封顶常量算，免得每次调数值都要改测试（曾经 25%→20%→15%→10% 连改四次）
    const cap = (final: number) => Math.min(2, final * SWORD_DOMINION_CAP)
    const round1 = (v: number) => Math.round(v * 10) / 10 // 钩子返回前按 1 位小数取整

    it(`增伤不超过原伤害的 ${SWORD_DOMINION_CAP * 100}%：弱击被夹住`, () => {
        const heavy = getAction('follow_the_current')! // 4 AP 单段：sqrt(4)=2 增伤
        // 原伤害 20 → 上限 2 ≥ 2 → 按 2 增伤（正好贴上限）
        expect(hit(20, heavy)).toBeCloseTo(22)
        // 弱击被夹到上限
        expect(hit(4, heavy)).toBeCloseTo(4 + cap(4))
        expect(hit(2, heavy)).toBeCloseTo(2 + cap(2))
        // 封顶确实生效：没被 sqrt(ap)=2 抬高
        expect(hit(4, heavy)).toBeLessThan(6)
    })

    it('多段招按每段算：27 段的暴雨梨花每段增伤极小，不会被抬高', () => {
        const many = getAction('tempest')! // ap5 / independentHits 27 → 每段 sqrt(5)/27 ≈ 0.083
        const perHit = Math.sqrt(5) / 27
        expect(hit(3, many)).toBeCloseTo(round1(3 + Math.min(perHit, 3 * SWORD_DOMINION_CAP)))
        expect(hit(0.2, many)).toBeLessThan(0.2 + perHit) // 被每段上限夹住
    })
})

import { describe, it, expect } from 'vitest'
import { getBuff } from '../../data/buffs'
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

    it('增伤不超过原伤害的 25%：弱击被夹住', () => {
        const heavy = getAction('follow_the_current')! // 4 AP 单段：sqrt(4)=2 增伤，上限 25%
        // 原伤害 20 → 上限 5 > 2 → 按 2 增伤
        expect(hit(20, heavy)).toBeCloseTo(22)
        // 原伤害 4 → 上限 1 < 2 → 夹到 1（25%）
        expect(hit(4, heavy)).toBeCloseTo(5)
        // 原伤害 2 → 上限 0.5
        expect(hit(2, heavy)).toBeCloseTo(2.5)
    })

    it('多段招按每段算：27 段的暴雨梨花每段增伤极小，不会被抬高', () => {
        const many = getAction('tempest')! // ap5 / independentHits 27 → 每段 sqrt(5)/27 ≈ 0.08
        expect(hit(3, many)).toBeCloseTo(3.1)
        expect(hit(0.2, many)).toBeCloseTo(0.3) // 上限 0.05 < 0.083 → 夹到 0.05，再按 1 位小数取整
    })
})

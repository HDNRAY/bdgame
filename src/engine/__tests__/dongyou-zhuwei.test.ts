import { describe, it, expect } from 'vitest'
import { getBuff } from '../../data/buffs'
import type { BuffLayer } from '../combat/types'

/** 构造看破 buff 的 layer（含 kanpo_<tag> 计数） */
function layer(counts: Record<string, number>): BuffLayer {
    return { restoreValue: 1, extra: counts }
}

describe('dongyou_zhuwei 洞幽烛微', () => {
    const buff = getBuff('dongyou_zhuwei')!

    it('buff 定义存在且钩子齐全', () => {
        expect(buff).toBeDefined()
        expect(buff.onOpponentAction).toBeTypeOf('function')
        expect(buff.onDodgeChance).toBeTypeOf('function')
        expect(buff.onTakeDamage).toBeTypeOf('function')
    })

    it('onOpponentAction 按招式 tag 累计看破次数', () => {
        const l = layer({})
        const source = { tags: ['slash', 'burn'] }
        buff.onOpponentAction!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: l, source: source as never })
        buff.onOpponentAction!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: l, source: source as never })
        expect(l.extra?.['kanpo_slash']).toBe(2)
        expect(l.extra?.['kanpo_burn']).toBe(2)
    })

    it('看破率 = min(8%, 2%×log2(1+各tag次数之和))', () => {
        const rate1 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 1 }), source: { tags: ['slash'] } as never })
        expect(rate1).toBeCloseTo(0.02, 5)
        // 3 次 → 2×log2(4) = 4%
        const rate3 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 3 }), source: { tags: ['slash'] } as never })
        expect(rate3).toBeCloseTo(0.04, 5)
        // 7 次 → 2×log2(8) = 6%
        const rate7 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 7 }), source: { tags: ['slash'] } as never })
        expect(rate7).toBeCloseTo(0.06, 5)
        // 15 次 → 2×log2(16) = 8% → 封顶
        const rate15 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 15 }), source: { tags: ['slash'] } as never })
        expect(rate15).toBe(0.08)
        // 31 次仍封顶 8%
        const rate31 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 31 }), source: { tags: ['slash'] } as never })
        expect(rate31).toBe(0.08)
        // 100 次仍封顶 8%
        const rate100 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 100 }), source: { tags: ['slash'] } as never })
        expect(rate100).toBe(0.08)
    })

    it('多 tag 招式取各 tag 次数之和', () => {
        // slash 3 + burn 1 → 共 4 次 → 2×log2(5) ≈ 4.64%
        const rate = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 3, kanpo_burn: 1 }), source: { tags: ['slash', 'burn'] } as never })
        expect(rate).toBeCloseTo(2 * Math.log2(5) / 100, 5)
    })

    it('未看破的 tag 不加成', () => {
        const rate = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 5 }), source: { tags: ['poison'] } as never })
        expect(rate).toBe(0)
    })

    it('减伤按看破率等比削减', () => {
        const final = buff.onTakeDamage!({ final: 100, raw: 100, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 15 }), source: { tags: ['slash'] } as never })
        expect(final).toBe(92) // 100 × (1 - 0.08)
    })
})

import { describe, it, expect } from 'vitest'
import { OPPONENTS } from '../data/opponents/index'
import { STAT_NAMES } from '../data/rewards'
import { cultCost } from '../systems/cultivation'

/** 从统一起点 {3,3,3,3,3,3} 到最终属性反推修炼花费 */
function calcCultCost(attrs: Record<string, number>): number {
    let total = 0
    for (const a of STAT_NAMES) {
        const start = 3
        const end = attrs[a] ?? 3
        for (let v = start; v < end; v++) total += cultCost(v)
    }
    return total
}

describe('opponents', () => {
    for (const def of OPPONENTS) {
        describe(def.name, () => {
            const build = def.generate(33)

            it('total cultivation cost matches points (n × 2)', () => {
                const cost = calcCultCost(def.targetAttrs)
                // 腊月天生道种加成后目标值72（64 + 8）
                const expected: Record<string, number> = { layue: 72 }
                expect(cost).toBe(expected[def.id] ?? 64)
            })

            it('generates a valid build', () => {
                const sum = STAT_NAMES.reduce((s, a) => s + (build.baseAttrs[a] ?? 0), 0)
                expect(sum).toBeGreaterThan(60)
                expect(build.rewards.length).toBeGreaterThan(0)
                expect(build.weapon).toBeTruthy()
            })
        })
    }
})

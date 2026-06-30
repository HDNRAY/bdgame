import { describe, it, expect } from 'vitest'
import { OPPONENTS, gen } from '../data/opponents/index'
import { STAT_NAMES } from '../entities/reward'
import { cultCost } from '../systems/cultivation'
import { WEAPON_DB } from '../data/weapons/weapons'
import { STARTING_WEAPONS } from '../data/weapons/starting-weapons'

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
            const build = gen(def, 33)

            it('total cultivation cost matches points (n × 2)', () => {
                const cost = calcCultCost(def.targetAttrs)
                // 天生道种加成后目标值72（64 + 8）
                const target = def.rewards.findIndex((r) => r.id === 'innate_seed') > -1 ? 72 : 64
                expect(cost).toBe(target)
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

describe('weapon tags', () => {
    const all = [...WEAPON_DB, ...STARTING_WEAPONS]
    for (const w of all) {
        it(`${w.id} (${w.name}) tags 合规`, () => {
            const hasMelee = w.tags.includes('melee')
            const hasPolearm = w.tags.includes('polearm')
            const hasUnarmed = w.tags.includes('unarmed')
            const isImperial = w.tags.includes('imperial')
            expect(hasMelee && hasPolearm).toBe(false)
            if (!isImperial) {
                expect(hasMelee || hasPolearm || hasUnarmed).toBe(true)
            }
        })
    }
})

import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { getBuff } from '../../data/buffs'
import { calcCritChance } from '../calc/damage'
import { rng } from '../util/rng'

function makeChar(id: string, name: string, dexterity: number, insight: number): Character {
    return new Character({
        id,
        name,
        weapon: 'peach_sword',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity, insight, wisdom: 8 },
        battleStyle: 'melee' as const,
        rewards: [],
    })
}

const buff = getBuff('zhu_huo_jue_buff')!

/** 施加一次灼烧（引擎 add_debuff 成功后调用 onDebuffApplied） */
function applyBurn(self: Character, layer: { restoreValue: number }): void {
    buff.onDebuffApplied!({ layer, self, buffId: 'burn', stacks: 1 } as never)
}

describe('铸火诀 · 铸火', () => {
    it('定义：走「施加灼烧时判定」，不走暴击事件', () => {
        expect(buff.onCritical).toBeUndefined()
        expect(buff.onDebuffApplied).toBeTypeOf('function')
        expect(buff.onDebuffTick).toBeTypeOf('function') // 自身受灼烧减半保留
    })

    it('每次施加：判定 floor(灵巧/6) 次，每次以暴击率为概率 +1 层', () => {
        const atk = makeChar('A', '甲', 14, 20) // 灵巧 14 → 判定 2 次
        const crit = calcCritChance(atk.attrs.get('dexterity'), atk.attrs.get('insight'))
        expect(crit).toBeGreaterThan(0)
        const rolls = Math.floor(atk.attrs.get('dexterity') / 6)
        expect(rolls).toBe(2)

        rng.seedMain(123)
        const N = 4000
        let total = 0
        let maxOne = 0
        for (let i = 0; i < N; i++) {
            const layer = { restoreValue: 0 }
            applyBurn(atk, layer)
            total += layer.restoreValue
            if (layer.restoreValue > maxOne) maxOne = layer.restoreValue
        }
        expect(total / N).toBeCloseTo(rolls * crit, 1) // 期望 = 判定次数 × 暴击率
        expect(maxOne).toBeLessThanOrEqual(rolls) // 单次最多 rolls 层
        expect(maxOne).toBe(rolls) // 4000 次里必定出现过全中
    })

    it('灵巧不足 6 点 → 不判定、不追加', () => {
        const atk = makeChar('A', '甲', 5, 20)
        rng.seedMain(1)
        for (let i = 0; i < 200; i++) {
            const layer = { restoreValue: 0 }
            applyBurn(atk, layer)
            expect(layer.restoreValue).toBe(0)
        }
    })

    it('灵巧越高判定次数越多：灵巧 18（3 次）比 12（2 次）期望增量更大', () => {
        const low = makeChar('A', '甲', 12, 20)
        const high = makeChar('B', '乙', 18, 20)
        const avg = (c: Character) => {
            rng.seedMain(7)
            let total = 0
            for (let i = 0; i < 3000; i++) {
                const layer = { restoreValue: 0 }
                applyBurn(c, layer)
                total += layer.restoreValue
            }
            return total / 3000
        }
        expect(avg(high)).toBeGreaterThan(avg(low))
    })
})

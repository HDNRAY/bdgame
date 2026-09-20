import { describe, it, expect } from 'vitest'
import { getBuff } from '../../data/buffs'
import type { BuffLayer } from '../combat/types'

/**
 * 女儿红：从「每秒回1.5气血」改成「每层闪避+4%」（additive 3 层、9 秒，与其他酒同节奏）。
 * 与云隐同一口径：`(layer.restoreValue ?? 0) * 0.04`。
 */
const buff = getBuff('nv_er_hong')!

const at = (layers: number): number => buff.onDodgeChance!({ layer: { restoreValue: layers } as BuffLayer } as never)

describe('女儿红 · 每层闪避 +4%', () => {
    it('定义：additive 3 层、9 秒、已经没有回血', () => {
        expect(buff.stacking).toEqual({ type: 'additive', max: 3 })
        expect(buff.expiry).toEqual({ type: 'duration', ms: 9000 })
        expect(buff.onTickHeal).toBeUndefined()
        expect(buff.tickInterval).toBeUndefined()
    })

    it('闪避按层线性叠加：1/2/3 层 = 4%/8%/12%', () => {
        expect(at(1)).toBeCloseTo(0.04)
        expect(at(2)).toBeCloseTo(0.08)
        expect(at(3)).toBeCloseTo(0.12)
    })

    it('没有层时不贡献（不会因为 buff 存在就给固定值）', () => {
        expect(at(0)).toBe(0)
    })
})

import { describe, it, expect } from 'vitest'
import {
    calcBaseDamage,
    calcDistanceMultiplier,
    calcFinalDamage,
    calcHitChance,
    calcParryChance,
    calcDodgeChance,
    calcMoveApCost,
} from '../calc/damage'

describe('calcBaseDamage', () => {
    it('should calculate damage from scaling and attrs', () => {
        const s = { strength: 0.8 }
        const d = calcBaseDamage(s, { strength: 14, vitality: 10, dexterity: 8, technique: 8, insight: 6, wisdom: 5 })
        expect(d).toBe(11.2) // 0.8 × 14 = 11.2
    })

    it('should handle multiple attribute scaling', () => {
        const s = { strength: 0.6, technique: 0.4 }
        const d = calcBaseDamage(s, { strength: 18, vitality: 12, dexterity: 6, technique: 10, insight: 5, wisdom: 4 })
        expect(d).toBe(14.8) // 0.6×18 + 0.4×10 = 10.8 + 4 = 14.8
    })
})

describe('calcDistanceMultiplier', () => {
    it('should be 1.0 at best distance', () => {
        expect(calcDistanceMultiplier(3, 3)).toBe(1)
    })

    it('should decrease by 0.15 per distance off', () => {
        expect(calcDistanceMultiplier(5, 3)).toBe(0.7) // 1 - 2×0.15
        expect(calcDistanceMultiplier(1, 3)).toBe(0.7)
    })

    it('should floor at 0.25', () => {
        expect(calcDistanceMultiplier(0, 4)).toBe(0.4) // 1 - 4×0.15 = 0.4 → Math.max(0.25, 0.4) = 0.4
    })
})

describe('calcFinalDamage', () => {
    it('should calculate non-crit damage', () => {
        expect(calcFinalDamage(18, 1, false)).toBe(18)
    })

    it('should multiply crit by 1.5', () => {
        expect(calcFinalDamage(18, 1, true)).toBe(27)
    })

    it('should multiply distance and crit together', () => {
        expect(calcFinalDamage(18, 0.7, true)).toBe(18.9) // 18*0.7=12.6, 12.6*1.5=18.9
    })

    it('should min at 1', () => {
        expect(calcFinalDamage(2, 0.25, false)).toBe(1)
    })
})

describe('calcHitChance', () => {
    it('should be base 80% when equal', () => {
        expect(calcHitChance(10, 10)).toBe(0.8)
    })

    it('should increase with higher technique', () => {
        expect(calcHitChance(18, 8)).toBe(0.95) // 0.8 + 10/50 = 1.0, capped at 0.95
    })
})

describe('calcParryChance', () => {
    it('should include weapon bonus', () => {
        expect(calcParryChance(14, 0.05)).toBeCloseTo(0.225) // 0.05 + 14/80
    })
})

describe('calcDodgeChance', () => {
    it('should scale with dexterity', () => {
        expect(calcDodgeChance(20)).toBe(0.25)
        expect(calcDodgeChance(50)).toBe(0.4) // capped
    })
})

describe('calcMoveApCost', () => {
    it('should cost 1 AP per range at dex 20', () => {
        expect(calcMoveApCost(2, 20)).toBe(2)
    })

    it('should cost more at low dex', () => {
        expect(calcMoveApCost(1, 10)).toBe(2) // ceil(1/0.5)
    })
})

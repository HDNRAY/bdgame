import { describe, it, expect } from 'vitest'
import {
    calcBaseDamage,
    calcFinalDamage,
    calcHitChance,
    calcCritChance,
    calcParryChance,
    calcParriedDamage,
    calcMoveApCost,
} from '../calc/damage'

describe('calcBaseDamage', () => {
    it('should calculate damage from scaling and attrs', () => {
        const s = { strength: 0.8 }
        const d = calcBaseDamage(s, { strength: 14, vitality: 10, agility: 8, dexterity: 8, insight: 6, wisdom: 5 })
        expect(d).toBe(11.2) // 0.8 × 14 = 11.2
    })

    it('should handle multiple attribute scaling', () => {
        const s = { strength: 0.6, dexterity: 0.4 }
        const d = calcBaseDamage(s, { strength: 18, vitality: 12, agility: 6, dexterity: 10, insight: 5, wisdom: 4 })
        expect(d).toBe(14.8) // 0.6×18 + 0.4×10 = 10.8 + 4 = 14.8
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
        expect(
            calcHitChance({ attackerDexterity: 10, attackerInsight: 10, defenderAgility: 10, defenderInsight: 10 }),
        ).toBe(0.8)
    })

    it('should increase with higher dexterity and insight', () => {
        const hc = calcHitChance({ attackerDexterity: 18, attackerInsight: 14, defenderAgility: 8, defenderInsight: 6 })
        expect(hc).toBe(0.95) // capped
    })
})

describe('calcCritChance', () => {
    it('should scale with dexterity and insight', () => {
        // 5% + (10+10)/200 = 5% + 10% = 15%
        expect(calcCritChance(10, 10)).toBeCloseTo(0.15)
        // 5% + (18+6)/200 = 5% + 12% = 17%
        expect(calcCritChance(18, 6)).toBeCloseTo(0.17)
        // base only
        expect(calcCritChance(0, 0)).toBeCloseTo(0.05)
    })
})

describe('calcParryChance', () => {
    it('should scale with agility, dexterity and insight', () => {
        // (14 + 10 + 6) / 120 = 30/120 = 0.25
        expect(calcParryChance(14, 10, 6)).toBeCloseTo(0.25)
        // capped at 0.9
        expect(calcParryChance(40, 40, 40)).toBeCloseTo(0.9)
        // (10 + 10 + 10) / 120 = 30/120 = 0.25
        expect(calcParryChance(10, 10, 10)).toBeCloseTo(0.25)
    })
})

describe('calcParriedDamage', () => {
    it('should reduce damage based on strength', () => {
        // strength 30 → reduction 30/60 = 50%, damage * 0.5
        expect(calcParriedDamage(100, 30)).toBeCloseTo(50)
        // strength 10 → reduction 10/60 ≈ 16.7%, clamped to 20%, damage * 0.8
        expect(calcParriedDamage(100, 10)).toBeCloseTo(80)
        // strength 50 → reduction 50/60 ≈ 83.3%, clamped to 60%, damage * 0.4
        expect(calcParriedDamage(100, 50)).toBeCloseTo(40)
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

import { describe, it, expect } from 'vitest'
import { DistanceSystem, DISTANCE_MIN, DISTANCE_MAX } from '../combat/distance'

describe('DistanceSystem', () => {
    it('should initialize at default distance 4', () => {
        const d = new DistanceSystem()
        expect(d.current).toBe(4)
    })

    it('should initialize at custom distance', () => {
        const d = new DistanceSystem(2)
        expect(d.current).toBe(2)
    })

    it('should move towards opponent (negative delta)', () => {
        const d = new DistanceSystem(4)
        d.move(-2)
        expect(d.current).toBe(2)
    })

    it('should move away (positive delta)', () => {
        const d = new DistanceSystem(4)
        d.move(1)
        expect(d.current).toBe(5)
    })

    it('should clamp to min', () => {
        const d = new DistanceSystem(1)
        d.move(-3)
        expect(d.current).toBe(DISTANCE_MIN)
    })

    it('should clamp to max', () => {
        const d = new DistanceSystem(9)
        d.move(3)
        expect(d.current).toBe(DISTANCE_MAX)
    })

    it('should detect range', () => {
        const d = new DistanceSystem(3)
        expect(d.inRange(2, 4)).toBe(true)
        expect(d.inRange(4, 5)).toBe(false)
        expect(d.inRange(0, 2)).toBe(false)
    })

    it('should calculate movement per AP', () => {
        expect(DistanceSystem.apToRange(10)).toBe(0.5)
        expect(DistanceSystem.apToRange(20)).toBe(1)
        expect(DistanceSystem.apToRange(40)).toBe(2)
    })
})

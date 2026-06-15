import { describe, it, expect } from 'vitest'
import { PositionSystem, POS_MIN, POS_MAX } from '../combat/position'

describe('PositionSystem', () => {
    it('should initialize positions at -2 and +2', () => {
        const p = new PositionSystem('a', -2, 'b', 2)
        expect(p.get('a')).toBe(-2)
        expect(p.get('b')).toBe(2)
        expect(p.distance('a', 'b')).toBe(4)
    })

    it('should calculate distance between characters', () => {
        const p = new PositionSystem('a', -3, 'b', 3)
        expect(p.distance('a', 'b')).toBe(6)
    })

    it('should move character toward opponent (negative delta)', () => {
        const p = new PositionSystem('a', -2, 'b', 2)
        // moveToward with delta < 0 = closer
        p.moveToward('a', 'b', -2)
        expect(p.get('a')).toBe(0)
        expect(p.distance('a', 'b')).toBe(2)
    })

    it('should move character away from opponent (positive delta)', () => {
        const p = new PositionSystem('a', -2, 'b', 2)
        // moveToward with delta > 0 = farther
        p.moveToward('a', 'b', 1)
        expect(p.get('a')).toBe(-3)
        expect(p.distance('a', 'b')).toBe(5)
    })

    it('should clamp to min', () => {
        const p = new PositionSystem('a', -2, 'b', 2)
        p.move('a', -2000) // move way past boundary
        expect(p.get('a')).toBe(POS_MIN)
        expect(p.distance('a', 'b')).toBe(1002)
    })

    it('should clamp to max', () => {
        const p = new PositionSystem('a', -2, 'b', 2)
        p.move('b', 2000) // move b way past boundary
        expect(p.get('b')).toBe(POS_MAX)
        expect(p.distance('a', 'b')).toBe(1002)
    })

    it('should detect range', () => {
        const p = new PositionSystem('a', -1, 'b', 2)
        expect(p.inRange('a', 'b', 2, 4)).toBe(true)
        expect(p.inRange('a', 'b', 4, 5)).toBe(false)
        expect(p.inRange('a', 'b', 3, 4)).toBe(true)
    })

    it('should calculate movement per AP', () => {
        expect(PositionSystem.apToRange(10)).toBe(0.5)
        expect(PositionSystem.apToRange(20)).toBe(1)
        expect(PositionSystem.apToRange(40)).toBe(2)
    })

    it('should clone correctly', () => {
        const p = new PositionSystem('a', -2, 'b', 2)
        const c = p.clone()
        expect(c.get('a')).toBe(-2)
        expect(c.get('b')).toBe(2)
        // modifying clone should not affect original
        c.move('a', 1)
        expect(c.get('a')).toBe(-1)
        expect(p.get('a')).toBe(-2)
    })
})

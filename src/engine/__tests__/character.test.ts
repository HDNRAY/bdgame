import { describe, it, expect } from 'vitest'
import { Character, calcMaxHp } from '../entities/character'

function mc(id: string, name: string, attrs: Record<string, number> = {}): Character {
    return new Character({
        id,
        name,
        baseAttrs: attrs,
        moves: [],
        triggers: [],
        passives: [],
        artifacts: [],
        weapon: 'bare_hands',
    })
}

describe('calcMaxHp', () => {
    it('should calculate HP correctly', () => {
        expect(calcMaxHp(10)).toBe(120)
        expect(calcMaxHp(20)).toBe(220)
        expect(calcMaxHp(30)).toBe(320)
    })
})

describe('Character', () => {
    it('should create with default attributes', () => {
        const c = mc('test_1', '测试角色')
        expect(c.name).toBe('测试角色')
        expect(c.attrs.total()).toBe(18)
        expect(c.hp).toBe(calcMaxHp(3))
        expect(c.ap).toBe(10)
    })

    it('should create with custom attributes', () => {
        const c = mc('test_2', '武者', { strength: 14, vitality: 12 })
        expect(c.attrs.get('strength')).toBe(14)
        expect(c.hp).toBe(calcMaxHp(12))
    })

    it('should handle damage and healing', () => {
        const c = mc('test_3', '坦克', { vitality: 20 })
        const fullHp = c.hp

        c.takeDamage(50)
        expect(c.hp).toBe(fullHp - 50)

        c.heal(20)
        expect(c.hp).toBe(fullHp - 30)

        c.takeDamage(1000)
        expect(c.hp).toBe(0)
        expect(c.isAlive()).toBe(false)
    })

    it('should handle AP spending', () => {
        const c = mc('test_4', '武者')
        expect(c.spendAp(3)).toBe(true)
        expect(c.ap).toBe(7)
        expect(c.spendAp(8)).toBe(false)
        expect(c.ap).toBe(7)

        c.resetAp()
        expect(c.ap).toBe(10)
    })
})

import { describe, it, expect } from 'vitest'
import { TurnManager } from '../combat/turn'
import { Character } from '../entities/character'

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

describe('TurnManager', () => {
    it('should order characters by action time', () => {
        const tm = new TurnManager()
        const fast = mc('fast', '快', { dexterity: 20 })
        const slow = mc('slow', '慢', { dexterity: 5 })

        tm.addCharacter(fast, 100)
        tm.addCharacter(slow, 300)

        expect(tm.peek()?.characterId).toBe('fast')
        tm.next()
        expect(tm.peek()?.characterId).toBe('slow')
    })

    it('should reschedule after action', () => {
        const tm = new TurnManager()
        const c = mc('c1', '武者')
        tm.addCharacter(c, 100)
        tm.next()

        tm.scheduleNext('c1', 250)
        expect(tm.peek()?.characterId).toBe('c1')
        expect(tm.peek()?.nextActionAt).toBe(100 + 250)
    })

    it('should handle stun (add time)', () => {
        const tm = new TurnManager()
        const a = mc('a', 'A')
        const b = mc('b', 'B')
        tm.addCharacter(a, 100)
        tm.addCharacter(b, 200)

        tm.modifyTime('a', 300) // a 被眩晕 +300ms
        expect(tm.peek()?.characterId).toBe('b')
    })
})

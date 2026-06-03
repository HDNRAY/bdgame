import { describe, it, expect } from 'vitest'
import { BattleEngine } from '../combat/engine'
import { simulateFight } from '../combat/simulate'
import { Character } from '../entities/character'
import { getAction } from '../data/actions'

function equip(c: Character, id: string) {
    const a = getAction(id)
    if (a) c.equipAction(a)
}

describe('BattleEngine', () => {
    it('should simulate a fight with action data', () => {
        const p = new Character('p1', '玩家', {
            strength: 14,
            vitality: 12,
            dexterity: 10,
            technique: 10,
            insight: 8,
            wisdom: 6,
        })
        equip(p, 'straight_punch')
        const o = new Character('o1', '野怪', {
            strength: 8,
            vitality: 8,
            dexterity: 6,
            technique: 6,
            insight: 4,
            wisdom: 3,
        })
        equip(o, 'straight_punch')
        const { winner, engine } = simulateFight(p, o, 'straight_punch')
        expect(winner).toBe('玩家')
        const types = engine.state.log.getAll().map((e) => e.event.type)
        expect(types).toContain('battle_start')
        expect(types).toContain('defeat')
    })

    it('should handle distance management with thrown weapon', () => {
        const p = new Character('p1', '远程', {
            technique: 12,
            dexterity: 14,
            strength: 6,
            vitality: 8,
            insight: 6,
            wisdom: 10,
        })
        const o = new Character('o1', '近战', {
            strength: 14,
            vitality: 10,
            dexterity: 8,
            technique: 6,
            insight: 4,
            wisdom: 3,
        })
        const e = new BattleEngine(p, o, 5)
        const r = e.execute({ type: 'attack', actionId: 'needle' })
        expect(r.hit).toBeDefined()
    })

    it('should end when a character dies', () => {
        const w = new Character('w', '弱者', {
            strength: 3,
            vitality: 3,
            dexterity: 3,
            technique: 3,
            insight: 3,
            wisdom: 3,
        })
        equip(w, 'fissure')
        const s = new Character('s', '强者', {
            strength: 18,
            vitality: 20,
            dexterity: 10,
            technique: 14,
            insight: 8,
            wisdom: 6,
        })
        equip(s, 'fissure')
        expect(simulateFight(w, s, 'fissure').winner).toBe('强者')
    })

    it('should log with action names', () => {
        const a = new Character('a', 'A', {
            strength: 10,
            vitality: 10,
            dexterity: 10,
            technique: 10,
            insight: 6,
            wisdom: 5,
        })
        const b = new Character('b', 'B', {
            strength: 10,
            vitality: 10,
            dexterity: 10,
            technique: 10,
            insight: 6,
            wisdom: 5,
        })
        const engine = new BattleEngine(a, b, 1) // 起手距离 1，在拳范围内
        engine.execute({ type: 'attack', actionId: 'straight_punch' })
        const logs = engine.state.log.getAll()
        const attacks = logs.filter((l) => l.event.type === 'attack_start')
        expect(attacks.length).toBeGreaterThan(0)
        if (attacks[0].event.type === 'attack_start') {
            expect(attacks[0].event.actionName).toBe('正拳')
        }
    })
})

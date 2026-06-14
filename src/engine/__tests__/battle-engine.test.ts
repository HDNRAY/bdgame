import { describe, it, expect } from 'vitest'
import { BattleEngine } from '../combat/engine'
import type { EventPlan } from '../combat/types'
import { runBattle } from '../battle-runner'
import { Character } from '../entities/character'

function makeChar(
    id: string,
    name: string,
    attrs: Record<string, number>,
    moveIds: string[] = [],
    weapon = 'bare_hands',
): Character {
    const rewards = moveIds.map((id) => ({
        type: 'action' as const,
        id,
        name: id,
        description: '',
        tags: [] as never[],
    }))
    return new Character({
        id,
        name,
        background: 'balanced',
        weapon,
        baseAttrs: attrs,
        rewards,
        triggers: [],
    })
}

describe('BattleEngine', () => {
    it('should simulate a fight with action data', () => {
        const p = makeChar(
            'laifeng',
            '玩家',
            { strength: 14, vitality: 12, agility: 10, dexterity: 10, insight: 8, wisdom: 6 },
            ['straight_punch'],
        )
        const o = makeChar(
            'o1',
            '野怪',
            { strength: 8, vitality: 8, agility: 6, dexterity: 6, insight: 4, wisdom: 3 },
            ['straight_punch'],
        )
        const { winner, engine } = runBattle(p, o)
        expect(winner).toBe('laifeng')
        const types = engine.state.log.getAll().map((e) => e.event.type)
        expect(types).toContain('battle_start')
        expect(types).toContain('defeat')
    })

    it('should handle distance management with spear', () => {
        const p = makeChar(
            'laifeng',
            '远程',
            { dexterity: 12, agility: 14, strength: 6, vitality: 8, insight: 6, wisdom: 10 },
            ['needle'],
            'iron_spear',
        )
        const o = makeChar('o1', '近战', {
            strength: 14,
            vitality: 10,
            agility: 8,
            dexterity: 6,
            insight: 4,
            wisdom: 3,
        })
        const e = new BattleEngine(p, o, 4)
        const plan: EventPlan = () => [{ type: 'attack', actionId: 'needle' }]
        e.runEvent(plan)
        const logs = e.state.log.getAll()
        const attacks = logs.filter((l) => l.event.type === 'attack_start')
        expect(attacks.length).toBeGreaterThan(0)
    })

    it('should end when a character dies', () => {
        const w = makeChar(
            'w',
            '弱者',
            { strength: 14, vitality: 10, agility: 10, dexterity: 10, insight: 6, wisdom: 5 },
            ['fissure'],
        )
        const s = makeChar(
            's',
            '强者',
            { strength: 18, vitality: 20, agility: 10, dexterity: 14, insight: 8, wisdom: 6 },
            ['fissure'],
        )
        const { winner, engine } = runBattle(w, s)
        // 战斗应该结束且有胜者
        expect(engine.state.phase).toBe('finished')
        expect(winner).toBeTruthy()
        // 应该只有一个存活
        const alive = engine.state.characters.filter((c) => c.isAlive())
        expect(alive.length).toBe(1)
    })

    it('should log with action names', () => {
        const a = makeChar('a', 'A', {
            strength: 10,
            vitality: 10,
            agility: 10,
            dexterity: 10,
            insight: 6,
            wisdom: 5,
        })
        const b = makeChar('b', 'B', {
            strength: 10,
            vitality: 10,
            agility: 10,
            dexterity: 10,
            insight: 6,
            wisdom: 5,
        })
        const engine = new BattleEngine(a, b, 1)
        const plan: EventPlan = () => [{ type: 'attack', actionId: 'straight_punch' }]
        engine.runEvent(plan)
        const logs = engine.state.log.getAll()
        const attacks = logs.filter((l) => l.event.type === 'attack_start')
        expect(attacks.length).toBeGreaterThan(0)
        if (attacks[0].event.type === 'attack_start') {
            expect(attacks[0].event.actionName).toBe('正拳')
        }
    })
})

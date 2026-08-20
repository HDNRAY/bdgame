import { describe, it, expect } from 'vitest'
import { BattleEngine } from '../combat/engine'
import type { EventPlan } from '../combat/types'
import { Character } from '../entities/character'

function makeChar(id: string, name: string, attrs: Record<string, number>, rewards: unknown[], weapon = 'bare_hands'): Character {
    return new Character({
        id,
        name,
        story: 'balanced',
        weapon,
        baseAttrs: attrs,
        rewards: rewards as never[],
    })
}

const PUNCH = { type: 'action', id: 'straight_punch', name: 'x', description: '', tags: [] }

function agilityAfter(attrs: Record<string, number>, weapon: string, rewards: unknown[]): number {
    const p = makeChar('p', 'P', attrs, [PUNCH, ...rewards], weapon)
    const o = makeChar('o', 'O', { strength: 8, vitality: 8, agility: 6, dexterity: 6, insight: 4, wisdom: 3 }, [PUNCH])
    const e = new BattleEngine(p, o, 4)
    const plan: EventPlan = () => [{ type: 'attack', actionId: 'straight_punch' }]
    for (let i = 0; i < 60 && e.state.phase === 'fighting'; i++) {
        const self = e.state.turn.peek()
        e.runEvent(self?.id === p.id ? plan : () => [])
    }
    const c = e.getCharacter('p')!
    return c.attrs.get('agility')
}

describe('heavy_load 重器负担', () => {
    const A = { strength: 4, vitality: 12, agility: 10, dexterity: 10, insight: 8, wisdom: 6 }
    const A8 = { strength: 8, vitality: 12, agility: 10, dexterity: 10, insight: 8, wisdom: 6 }
    const A12 = { strength: 12, vitality: 12, agility: 10, dexterity: 10, insight: 8, wisdom: 6 }
    const XUAN = { type: 'passive', id: 'dark_iron_sword_art', name: 'x', description: '', tags: [] }
    const TIDE = { type: 'passive', id: 'tide_inner_power', name: 'x', description: '', tags: [] }

    it('力量4+铁枪(tier6) → 身法-2', () => expect(agilityAfter(A, 'iron_spear', [])).toBe(8))
    it('力量4+铁枪+玄剑 → 无惩罚', () => expect(agilityAfter(A, 'iron_spear', [XUAN])).toBe(10))
    it('力量8+绣冬(tier10) → 身法-2', () => expect(agilityAfter(A8, 'xiu_dong', [])).toBe(8))
    it('力量8+绣冬+潮汐 → 潮汐挪移身法至14（无惩罚）', () => expect(agilityAfter(A8, 'xiu_dong', [TIDE])).toBe(14))
    it('力量12+素铁霸刀(tier14) → 身法-2', () => expect(agilityAfter(A12, 'overlord_blade', [])).toBe(8))
    it('力量12+素铁霸刀+玄剑+潮汐 → 无惩罚（潮汐挪移身法至14）', () => expect(agilityAfter(A12, 'overlord_blade', [XUAN, TIDE])).toBe(14))
    it('力量10+镇北戟(tier10) → 无惩罚', () => expect(agilityAfter({ ...A, strength: 10 }, 'zhen_bei_ji', [])).toBe(10))
    it('力量12+玄铁重剑(tier14) → 身法-2', () => expect(agilityAfter(A12, 'dark_iron_sword', [])).toBe(8))
})

import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { getAction } from '../../data/actions'

function makeChar(id: string, name: string, weapon: string): Character {
    return new Character({
        id, name, weapon,
        baseAttrs: { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 },
        rewards: [],
    })
}

describe('step_back + 推掌', () => {
    it('step_back:使用者后撤 1m(远离对手)', () => {
        const atk = makeChar('A', '甲', 'bare_hands')
        const def = makeChar('B', '乙', 'bare_hands')
        const engine = new BattleEngine(atk, def, 4)
        const pos = engine.state.position
        const before = pos.distance(atk.id, def.id)
        processActionEffect({ type: 'step_back', distance: 1 }, { self: atk, enemy: def, engine, tMs: 0 })
        // 攻击者后撤 → 距离 +1
        expect(pos.distance(atk.id, def.id)).toBe(before + 1)
    })

    it('推掌:对手被推 1m + 自己后撤 1m,距离共 +2', () => {
        const atk = makeChar('A', '甲', 'bare_hands')
        const def = makeChar('B', '乙', 'bare_hands')
        const engine = new BattleEngine(atk, def, 4)
        const pos = engine.state.position
        const distBefore = pos.distance(atk.id, def.id)
        // 推掌 effects 顺序:damage → knockback(推对手) → step_back(自己退)
        processActionEffect({ type: 'knockback', distance: 1 }, { self: atk, enemy: def, engine, tMs: 0 })
        processActionEffect({ type: 'step_back', distance: 1 }, { self: atk, enemy: def, engine, tMs: 0 })
        expect(pos.distance(atk.id, def.id)).toBe(distBefore + 2)
    })

    it('推掌招式定义已替换 short_dash → step_back', () => {
        const a = getAction('push_hand')!
        expect(a.effects?.some((e) => e.type === 'step_back')).toBe(true)
        expect(a.effects?.some((e) => e.type === 'short_dash')).toBe(false)
    })
})

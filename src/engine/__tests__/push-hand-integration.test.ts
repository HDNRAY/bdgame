import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'

function makeChar(id: string, name: string, weapon: string, rewards: { type: 'action'; id: string }[]): Character {
    return new Character({
        id, name, weapon,
        baseAttrs: { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 },
        rewards,
    })
}

describe('推掌完整位移', () => {
    it('推掌效果序列:damage → knockback(推对手) → step_back(自己后撤)', () => {
        const atk = makeChar('A', '甲', 'bare_hands', [{ type: 'action', id: 'push_hand' }])
        const def = makeChar('B', '乙', 'bare_hands', [])
        const engine = new BattleEngine(atk, def, 4)
        const pos = engine.state.position
        const atk0 = pos.get(atk.id)
        const def0 = pos.get(def.id)
        // 模拟命中后的效果序列(engine #finalizeAttack 对非 pre-hit 效果按 effects 顺序执行)
        processActionEffect({ type: 'knockback', distance: 1 }, { self: atk, enemy: def, engine, tMs: 0 })
        processActionEffect({ type: 'step_back', distance: 1 }, { self: atk, enemy: def, engine, tMs: 0 })
        const atk1 = pos.get(atk.id)
        const def1 = pos.get(def.id)
        console.log(`atk: ${atk0}→${atk1}  def: ${def0}→${def1}  距离: ${pos.distance(atk.id, def.id)}`)
        // 对手被推远(远离攻击者),自己后撤(远离对手)→ 距离 +2
        expect(pos.distance(atk.id, def.id)).toBe(6)
        // 位置检查:甲向前(对方一侧),乙向后(更远)
        expect(def1).toBeGreaterThan(def0)
        expect(atk1).toBeLessThan(atk0)
    })
})

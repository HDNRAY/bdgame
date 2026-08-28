import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'

function makeChar(id: string, name: string, rewards: { type: 'passive'; id: string }[]): Character {
    return new Character({
        id, name, weapon: 'qimei_staff',
        baseAttrs: { strength: 20, vitality: 10, agility: 14, dexterity: 16, insight: 10, wisdom: 4 },
        rewards,
    })
}

function setup(engine: BattleEngine, atk: Character, stacks: number) {
    const key = `feng_mo_gun_fa::${atk.id}`
    engine.state.pendingBuffs.set(key, { restoreValue: stacks, buffId: 'feng_mo_gun_fa' })
    return engine.state.pendingBuffs.get(key)!
}

describe('疯魔棍法', () => {
    const rod = { tags: ['blunt', 'polearm'] }

    it('功法/buff 定义齐全', () => {
        expect(getPassive('feng_mo_gun_fa')).toBeDefined()
        const buff = getBuff('feng_mo_gun_fa')!
        expect(buff.stacking).toEqual({ type: 'additive', max: 5 })
        expect(buff.onDealDamage).toBeTypeOf('function')
        expect(buff.onTakeDamage).toBeTypeOf('function')
        expect(buff.onHitChance).toBeTypeOf('function')
    })

    it('完整节奏:第1-4棍逐层增伤,第5棍叠满(+25%不翻倍),第6棍爆发(必中+翻倍)归零', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const buff = getBuff('feng_mo_gun_fa')!
        const key = `feng_mo_gun_fa::${atk.id}`
        engine.state.pendingBuffs.set(key, { restoreValue: 0, buffId: 'feng_mo_gun_fa' })

        const hit = (base: number) => {
            const layer = engine.state.pendingBuffs.get(key)!
            return buff.onDealDamage!({ final: base, raw: base, target: def, attacker: atk, engine, state: engine.state, layer, source: rod } as never)
        }
        // 第1棍: 0→1层, +5%
        expect(hit(100)).toBe(105)
        // 第2棍: 1→2层, +10%
        expect(hit(100)).toBe(110)
        // 第3棍: 2→3层, +15%
        expect(hit(100)).toBe(115)
        // 第4棍: 3→4层, +20%
        expect(hit(100)).toBe(120)
        // 第5棍: 4→5层, +25% 不翻倍
        expect(hit(100)).toBe(125)
        expect(engine.state.pendingBuffs.get(key)!.restoreValue).toBe(5)
        // 第6棍: 满层, 必中+翻倍 → 100×1.25×2=250, 归零
        const layer = engine.state.pendingBuffs.get(key)!
        const hc = buff.onHitChance!({ final: 0, raw: 0, target: def, attacker: atk, engine, state: engine.state, layer, source: rod } as never)
        expect(hc).toBe(1)
        expect(hit(100)).toBe(250)
        expect(engine.state.pendingBuffs.has(key)).toBe(false)
    })

    it('受到伤害+5%/层(伤换伤)', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const layer = setup(engine, atk, 3)
        const buff = getBuff('feng_mo_gun_fa')!
        const dmg = buff.onTakeDamage!({ final: 100, raw: 100, target: atk, attacker: def, engine, state: engine.state, layer, source: { tags: ['qi'] } } as never)
        expect(dmg).toBe(115)
    })

    it('非棍招不叠层,但仍吃当前层增伤', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const layer = setup(engine, atk, 2)
        const buff = getBuff('feng_mo_gun_fa')!
        const qiSource = { tags: ['qi', 'range'] }
        const dmg = buff.onDealDamage!({ final: 100, raw: 100, target: def, attacker: atk, engine, state: engine.state, layer, source: qiSource } as never)
        expect(dmg).toBe(110) // 2层+10%
        expect(layer.restoreValue).toBe(2) // 不叠
    })
})

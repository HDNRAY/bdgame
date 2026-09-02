import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'

function makeChar(id: string, name: string, rewards: { type: 'passive'; id: string }[]): Character {
    return new Character({
        id,
        name,
        weapon: 'qimei_staff',
        baseAttrs: { strength: 20, vitality: 10, agility: 14, dexterity: 16, insight: 10, wisdom: 4 },        battleStyle: 'mid' as const,

        rewards: rewards.map((r) => ({ ...r, name: r.id, description: '', tags: [] })),
    })
}

function setup(engine: BattleEngine, atk: Character, stacks: number) {
    const key = `feng_mo_gong::${atk.id}`
    engine.state.pendingBuffs.set(key, { restoreValue: stacks, buffId: 'feng_mo_gong' })
    return engine.state.pendingBuffs.get(key)!
}

describe('疯魔功', () => {
    const main = { tags: ['blunt', 'polearm'] }

    it('功法/buff 定义齐全', () => {
        expect(getPassive('feng_mo_gong')).toBeDefined()
        const buff = getBuff('feng_mo_gong')!
        expect(buff.stacking).toEqual({ type: 'additive', max: 10 })
        expect(buff.onDealDamage).toBeTypeOf('function')
        expect(buff.onTakeDamage).toBeTypeOf('function')
        expect(buff.apRegenPerSec).toBeTypeOf('function')
    })

    it('建层即归零:初始不带层(additive 需 stacks≥1 建层,onBuffApplied 清 0)', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const buff = getBuff('feng_mo_gong')!
        const layer = { restoreValue: 1, extra: {} }
        buff.onBuffApplied!({ self: atk, engine, state: engine.state, layer, buffId: 'feng_mo_gong' } as never)
        expect(layer.restoreValue).toBe(0) // 建层后归零,开局 0 层
    })

    it('持续成长:命中叠层,每层增伤1%,10层不归零', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const buff = getBuff('feng_mo_gong')!
        const key = `feng_mo_gong::${atk.id}`
        engine.state.pendingBuffs.set(key, { restoreValue: 0, buffId: 'feng_mo_gong' })

        const hit = (base: number) => {
            const layer = engine.state.pendingBuffs.get(key)!
            return buff.onDealDamage!({
                final: base,
                raw: base,
                target: def,
                attacker: atk,
                engine,
                state: engine.state,
                layer,
                source: main,
            } as never)
        }
        // 逐层 +1%
        expect(hit(100)).toBe(101) // 0→1层, +1%
        expect(hit(100)).toBe(102) // 1→2层, +2%
        expect(hit(100)).toBe(103) // 2→3层, +3%
        expect(engine.state.pendingBuffs.get(key)!.restoreValue).toBe(3)
        // 叠到 10 层不归零,继续 +10%
        engine.state.pendingBuffs.get(key)!.restoreValue = 10
        expect(hit(100)).toBe(110)
        expect(engine.state.pendingBuffs.has(key)).toBe(true) // 不归零
    })

    it('受伤+2%/层(伤换伤)', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const layer = setup(engine, atk, 3)
        const buff = getBuff('feng_mo_gong')!
        const dmg = buff.onTakeDamage!({
            final: 100,
            raw: 100,
            target: atk,
            attacker: def,
            engine,
            state: engine.state,
            layer,
            source: { tags: ['qi'] },
        } as never)
        expect(dmg).toBe(106) // 3层 × 2% = +6%
    })

    it('AP回复 = 0.03/层', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const layer = setup(engine, atk, 4)
        const buff = getBuff('feng_mo_gong')!
        const regen = buff.apRegenPerSec!({
            final: 0,
            raw: 0,
            target: atk,
            attacker: atk,
            engine,
            state: engine.state,
            layer,
        } as never)
        expect(regen).toBeCloseTo(0.12) // 4层 × 0.03
    })

    it('非主招(pre_action)不叠层,但仍吃当前层增伤', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const layer = setup(engine, atk, 2)
        const buff = getBuff('feng_mo_gong')!
        const preSource = { tags: ['qi', 'range', 'pre_action'] }
        const dmg = buff.onDealDamage!({
            final: 100,
            raw: 100,
            target: def,
            attacker: atk,
            engine,
            state: engine.state,
            layer,
            source: preSource,
        } as never)
        expect(dmg).toBe(102) // 2层 × 1% = +2%
        expect(layer.restoreValue).toBe(2) // 不叠
    })
})

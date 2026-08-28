import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'

function makeChar(id: string, name: string, rewards: { type: 'passive'; id: string }[]): Character {
    return new Character({
        id, name, weapon: 'bare_hands',
        baseAttrs: { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 },
        rewards,
    })
}

describe('周流不息(溢出转化)', () => {
    it('功法/buff 定义齐全', () => {
        expect(getPassive('zhou_liu_bu_xi')).toBeDefined()
        const buff = getBuff('zhou_liu_bu_xi')!
        expect(buff.stacking).toEqual({ type: 'additive', max: 3 })
        expect(buff.onChanOverflow).toBeTypeOf('function')
        expect(buff.onBuffApplied).toBeTypeOf('function')
        expect(buff.onHitChance).toBeTypeOf('function')
        expect(buff.onDealDamage).toBeTypeOf('function')
        expect(buff.onAction).toBeTypeOf('function')
    })

    it('battle_start 建层后层数为 0(由溢出驱动),不是 Lv.1', () => {
        const atk = makeChar('A', '甲', [{ type: 'passive', id: 'zhou_liu_bu_xi' }])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4) // 构造即 battle_start
        const layer = engine.state.pendingBuffs.get(`zhou_liu_bu_xi::${atk.id}`)
        expect(layer).toBeDefined()
        expect(layer!.restoreValue).toBe(0)
        expect(layer!.extra?.overflowAcc).toBe(0)
    })

    it('缠满后溢出10点叠1层', () => {
        const atk = makeChar('A', '甲', [{ type: 'passive', id: 'zhou_liu_bu_xi' }])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const buff = getBuff('zhou_liu_bu_xi')!
        const key = `zhou_liu_bu_xi::${atk.id}`
        atk.chan = 50
        // 溢出8,不足10不叠层
        let overflow = atk.addChan(8)
        let layer = engine.state.pendingBuffs.get(key)!
        buff.onChanOverflow!({ final: 0, raw: 0, target: atk, attacker: def, engine, state: engine.state, layer, overflow } as never)
        layer = engine.state.pendingBuffs.get(key)!
        expect(layer.restoreValue).toBe(0)
        // 再溢出2 → 累计10 → 叠1层
        overflow = atk.addChan(2)
        layer = engine.state.pendingBuffs.get(key)!
        buff.onChanOverflow!({ final: 0, raw: 0, target: atk, attacker: def, engine, state: engine.state, layer, overflow } as never)
        layer = engine.state.pendingBuffs.get(key)!
        expect(layer.restoreValue).toBe(1)
        // 再溢出12 → 叠1层,剩2累积
        overflow = atk.addChan(12)
        layer = engine.state.pendingBuffs.get(key)!
        buff.onChanOverflow!({ final: 0, raw: 0, target: atk, attacker: def, engine, state: engine.state, layer, overflow } as never)
        layer = engine.state.pendingBuffs.get(key)!
        expect(layer.restoreValue).toBe(2)
        expect(layer.extra?.overflowAcc).toBe(2)
    })

    it('主招命中+10%/层、伤害+10%/层,出招后清空', () => {
        const atk = makeChar('A', '甲', [{ type: 'passive', id: 'zhou_liu_bu_xi' }])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const key = `zhou_liu_bu_xi::${atk.id}`
        engine.state.pendingBuffs.set(key, { restoreValue: 2, buffId: 'zhou_liu_bu_xi', extra: {} })
        const buff = getBuff('zhou_liu_bu_xi')!
        const source = { tags: ['qi', 'range'] }
        const layer = engine.state.pendingBuffs.get(key)!
        const ctx = (extra: Record<string, unknown>) => ({ final: 100, raw: 100, target: def, attacker: atk, state: engine.state, layer, source, ...extra })
        expect(buff.onHitChance!(ctx({}) as never)).toBeCloseTo(0.2)
        expect(buff.onDealDamage!(ctx({}) as never)).toBe(120)
        buff.onAction!(ctx({}) as never)
        expect(engine.state.pendingBuffs.has(key)).toBe(false)
    })
})

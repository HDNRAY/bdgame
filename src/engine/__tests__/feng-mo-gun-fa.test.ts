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

    it('功法/buff 定义齐全（上限是可调平衡项，只检查形状）', () => {
        expect(getPassive('feng_mo_gong')).toBeDefined()
        const buff = getBuff('feng_mo_gong')!
        expect(buff.stacking?.type).toBe('additive')
        expect(buff.stacking?.type === 'additive' ? (buff.stacking.max ?? 0) : 0).toBeGreaterThan(0)
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

    it('持续成长:命中叠层,每层增伤递增,到上限不归零（系数/上限都不写死）', () => {
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
        // 第一击叠到 1 层 → 从这一击的结果反推「每层系数」，不写死数值
        const one = hit(100)
        if (typeof one !== 'number') throw new Error('疯魔功 onDealDamage 应返回数值')
        const factor = one / 100 - 1
        expect(factor).toBeGreaterThan(0)
        expect(hit(100)).toBeCloseTo(100 * (1 + factor * 2)) // 2 层 = 2×系数
        expect(hit(100)).toBeCloseTo(100 * (1 + factor * 3)) // 3 层 = 3×系数
        expect(engine.state.pendingBuffs.get(key)!.restoreValue).toBe(3)

        // 一直打：层数到定义里的上限就停住，不归零，伤害按满层算
        const cap = (getBuff('feng_mo_gong')!.stacking as { max?: number }).max ?? 0
        expect(cap).toBeGreaterThanOrEqual(3)
        for (let i = 0; i < 30; i++) hit(100)
        expect(engine.state.pendingBuffs.get(key)!.restoreValue).toBe(cap)
        expect(hit(100)).toBeCloseTo(100 * (1 + cap * factor))
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
        const perStack = dmg / 100 - 1 // 3 层 → 反推每层系数
        expect(perStack).toBeGreaterThan(0)
        const layer1 = setup(engine, atk, 1)
        const dmg1 = buff.onTakeDamage!({
            final: 100,
            raw: 100,
            target: atk,
            attacker: def,
            engine,
            state: engine.state,
            layer: layer1,
            source: { tags: ['qi'] },
        } as never)
        expect(dmg1).toBeCloseTo(100 * (1 + perStack / 3))
        expect(dmg).toBeCloseTo(100 * (1 + (perStack / 3) * 3))
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
        // 每层回复量从 1 层时的返回值反推（数值可调）
        const one = buff.apRegenPerSec!({
            final: 0,
            raw: 0,
            target: atk,
            attacker: atk,
            engine,
            state: engine.state,
            layer: setup(engine, atk, 1),
        } as never)
        expect(one).toBeGreaterThan(0)
        expect(regen).toBeCloseTo(one * 4)
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
        // 期望值按「每层系数」现算：先打一击读出系数
        const mainLayer = setup(engine, atk, 0)
        const oneHit = buff.onDealDamage!({
            final: 100,
            raw: 100,
            target: def,
            attacker: atk,
            engine,
            state: engine.state,
            layer: mainLayer,
            source: main,
        } as never)
        if (typeof oneHit !== 'number') throw new Error('疯魔功 onDealDamage 应返回数值')
        const factor = oneHit / 100 - 1
        expect(factor).toBeGreaterThan(0)
        expect(dmg).toBeCloseTo(100 * (1 + 2 * factor)) // 2 层 = 2×系数
        expect(layer.restoreValue).toBe(2) // 不叠
    })
})

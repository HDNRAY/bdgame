import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'

function makeChar(id: string, name: string): Character {
    return new Character({
        id,
        name,
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
        battleStyle: 'mid' as const,
        rewards: [],
    })
}

const layer = { restoreValue: 1, extra: {} }
const buff = getBuff('hun_yuan_gong_buff')!

/** 直接调钩子：返回值 = 实际挨的伤害（引擎 applyDefenseStages 就是把返回值当 final） */
function takeHit(
    engine: BattleEngine,
    target: Character,
    attacker: Character,
    final: number,
    tags: string[] = [],
): number {
    const out = buff.onTakeDamage!({
        final,
        raw: final,
        target,
        attacker,
        engine,
        state: engine.state,
        layer,
        source: { tags },
    } as never)
    if (typeof out !== 'number') throw new Error('混元炁 onTakeDamage 应返回数值')
    return out
}

describe('混元功 · 混元炁', () => {
    it('定义齐全（功法挂上 buff）', () => {
        expect(getPassive('hun_yuan_gong')).toBeDefined()
        expect(buff.onTakeDamage).toBeTypeOf('function')
    })

    it('1m 外：消耗「伤害一半」的缠，减掉一半伤害', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 4) // 距离 4m
        me.chan = 50
        expect(takeHit(engine, me, foe, 20, ['slash'])).toBe(10)
        expect(me.chan).toBe(40)
    })

    it('1m 外：缠不够就按能付的减（1 缠抵 1 伤）', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 4)
        me.chan = 3
        expect(takeHit(engine, me, foe, 20, ['slash'])).toBe(17)
        expect(me.chan).toBe(0)
    })

    it('1m 外：没有缠就不减，也不扣成负数', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 4)
        me.chan = 0
        expect(takeHit(engine, me, foe, 20, ['slash'])).toBe(20)
        expect(me.chan).toBe(0)
    })

    it('1m 外：门槛与近身共用 —— 不到10点且非炁不触发，炁伤害再轻也抵', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 4)
        me.chan = 50
        expect(takeHit(engine, me, foe, 5, ['slash'])).toBe(5) // 轻击：不抵
        expect(me.chan).toBe(50)
        expect(takeHit(engine, me, foe, 5, ['qi'])).toBe(2.5) // 炁：抵一半
        expect(me.chan).toBe(47.5)
    })

    it('阈值是「超过10点」：10 点不触发、11 点触发', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 4)
        me.chan = 50
        expect(takeHit(engine, me, foe, 10, ['slash'])).toBe(10) // 恰好 10 不打折
        expect(me.chan).toBe(50)
        expect(takeHit(engine, me, foe, 11, ['slash'])).toBe(5.5) // 超过 10 → 抵一半
        expect(me.chan).toBe(44.5)
    })

    it('1m 内：仍是反伤（自身承全额、耗等量缠反伤并击退），不走抵伤', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 1) // 距离 1m
        me.chan = 50
        const hpBefore = foe.hp
        expect(takeHit(engine, me, foe, 20, ['slash'])).toBe(20) // 全额
        expect(me.chan).toBe(40) // 反伤 10 消耗 10 缠
        expect(hpBefore - foe.hp).toBe(10)
    })

    it('1m 内：不满足「超过10点或炁」就不触发', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 1)
        me.chan = 50
        expect(takeHit(engine, me, foe, 5, ['slash'])).toBe(5)
        expect(me.chan).toBe(50)
    })
})

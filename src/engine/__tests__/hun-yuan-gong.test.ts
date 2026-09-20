import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

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

    it('1m 外：消耗「伤害三分之一」的缠，减掉三分之一伤害', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 4) // 距离 4m
        me.chan = 50
        expect(takeHit(engine, me, foe, 20, ['slash'])).toBeCloseTo(13.3) // 20 − 6.7
        expect(me.chan).toBe(43.3)
    })

    it('1m 外：缠不够就按能付的减（1 缠抵 1 伤）', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 4)
        me.chan = 3 // 上限 6.7 付不起
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

    it('1m 外：门槛与近身共用 —— 不到8点且非炁不触发，炁伤害再轻也抵', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 4)
        me.chan = 50
        expect(takeHit(engine, me, foe, 5, ['slash'])).toBe(5) // 轻击：不抵
        expect(me.chan).toBe(50)
        expect(takeHit(engine, me, foe, 5, ['qi'])).toBeCloseTo(3.3) // 炁：抵三分之一
        expect(me.chan).toBe(48.3)
    })

    it('阈值是「超过8点」：8 点不触发、9 点触发', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 4)
        me.chan = 50
        expect(takeHit(engine, me, foe, 8, ['slash'])).toBe(8) // 恰好 8 不打折
        expect(me.chan).toBe(50)
        expect(takeHit(engine, me, foe, 9, ['slash'])).toBe(6) // 超过 8 → 抵三分之一（9 − 3）
        expect(me.chan).toBe(47)
    })

    it('1m 内：仍是反伤（自身承全额、耗等量缠反伤并击退），不走抵伤', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 1) // 距离 1m
        me.chan = 50
        const hpBefore = foe.hp
        expect(takeHit(engine, me, foe, 20, ['slash'])).toBe(20) // 全额
        expect(me.chan).toBe(43.3) // 反伤 6.7 消耗 6.7 缠
        expect(hpBefore - foe.hp).toBeCloseTo(6.7)
    })

    it('1m 内：不满足「超过8点或炁」就不触发', () => {
        const me = makeChar('B', '乙')
        const foe = makeChar('A', '甲')
        const engine = new BattleEngine(foe, me, 1)
        me.chan = 50
        expect(takeHit(engine, me, foe, 5, ['slash'])).toBe(5)
        expect(me.chan).toBe(50)
    })
})

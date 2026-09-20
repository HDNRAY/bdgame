import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { getBuff } from '../../data/buffs'
import { getAction } from '../../data/actions'
import { ALL_ATTRS } from '../entities/attributes'
import { forEachBuffOf } from '../combat/utils'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

const buff = getBuff('zhu_ye_qing')!
const drink = getAction('_zhu_ye_qing')!

function makeChar(id: string): Character {
    return new Character({
        id,
        name: id,
        weapon: 'bare_hands',
        battleStyle: 'clinch',
        baseAttrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, 10])) as Character['build']['baseAttrs'],
        rewards: [],
    })
}

function setup(): { engine: BattleEngine; a: Character; b: Character } {
    const a = makeChar('a')
    const b = makeChar('b')
    return { engine: new BattleEngine(a, b, 4, false), a, b }
}

const drinkOnce = (engine: BattleEngine, a: Character, b: Character): void =>
    processActionEffect({ type: 'add_buff', buffId: 'zhu_ye_qing' }, { self: a, enemy: b, engine, tMs: engine.state.turn.currentTime })

/** 该角色身上竹叶青各层的 key（independent → 每层一个带 appId 的 key） */
function layerKeys(engine: BattleEngine, id: string): string[] {
    const out: string[] = []
    forEachBuffOf(engine.state.pendingBuffs, id, (_d, _l, buffId, key) => {
        if (buffId === 'zhu_ye_qing') out.push(key)
    })
    return out.sort()
}

const endTimes = (engine: BattleEngine, id: string): number[] =>
    layerKeys(engine, id)
        .map((k) => engine.state.turn.entries.find((e) => e.id === `buff_end_${k}`)?.nextActionAt ?? -1)
        .sort((x, y) => x - y)

describe('竹叶青 · independent 叠层', () => {
    it('定义：independent、9 秒、每层 +0.3/s', () => {
        expect(buff.stacking).toEqual({ type: 'independent' })
        expect(buff.expiry).toEqual({ type: 'duration', ms: 9000 })
        expect(buff.apRegenPerSec!({ layer: { restoreValue: 1 } } as never)).toBeCloseTo(0.3)
    })

    it('每次饮用是自己一层、自己一条计时：3 次 = 3 层 3 条 buff_end', () => {
        const { engine, a, b } = setup()
        drinkOnce(engine, a, b)
        expect(layerKeys(engine, a.id).length).toBe(1)
        // 让时钟往前走一点，第二/三层的到期时刻应当各不相同（不再共享一条计时器）
        for (let i = 0; i < 40 && engine.state.turn.currentTime < 1000; i++) engine.runEvent(() => [])
        drinkOnce(engine, a, b)
        for (let i = 0; i < 40 && engine.state.turn.currentTime < 2000; i++) engine.runEvent(() => [])
        drinkOnce(engine, a, b)

        const keys = layerKeys(engine, a.id)
        expect(keys.length).toBe(3)
        const times = endTimes(engine, a.id)
        expect(times.length).toBe(3)
        expect(new Set(times).size).toBe(3) // 三条计时互不相同
        expect(times[0]).toBeLessThan(times[2])
    })

    it('满 3 层后不再能喝（canUse 拦下，且不扣 AP）', () => {
        const { engine, a, b } = setup()
        for (let i = 0; i < 4; i++) drinkOnce(engine, a, b)
        expect(layerKeys(engine, a.id).length).toBe(4) // 直接 add_buff 绕过 canUse 仍会建层
        expect(drink.canUse!(a, engine.state)).toBe(false)

        // 走 support 执行路径：canUse 不满足 → 一点 AP 都不花、也不建层
        a.ap = a.maxAp
        const before = a.ap
        const keysBefore = layerKeys(engine, a.id).length
        engine.runEvent(() => [{ type: 'support', actionId: '_zhu_ye_qing' }])
        expect(a.ap).toBe(before)
        expect(layerKeys(engine, a.id).length).toBe(keysBefore)
    })

    it('到期逐层掉：跑到第一条 buff_end 只少一层', () => {
        const { engine, a, b } = setup()
        drinkOnce(engine, a, b)
        while (engine.state.turn.currentTime < 1000) engine.runEvent(() => [])
        drinkOnce(engine, a, b)
        expect(layerKeys(engine, a.id).length).toBe(2)

        const first = endTimes(engine, a.id)[0]
        for (let i = 0; i < 2000 && engine.state.turn.currentTime <= first; i++) {
            if (!engine.runEvent(() => [])) break
        }
        // 只掉了一层（不是一次全清）
        expect(layerKeys(engine, a.id).length).toBe(1)
    })
})

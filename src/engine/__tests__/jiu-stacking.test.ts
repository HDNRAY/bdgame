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

/**
 * 已经改成 independent 叠层的酒（每次饮用自己一层、自己一条 9 秒计时）。
 * 烧刀子 / 不老泉 / 女儿红仍是 additive（共享计时器 + 续饮刷新），暂不在本文件内。
 */
const CASES = [
    { label: '竹叶青', buffId: 'zhu_ye_qing', actionId: '_zhu_ye_qing', hook: 'apRegenPerSec' as const, perLayer: 0.3 },
    { label: '霸王醉', buffId: 'ba_wang_zui', actionId: '_jiu_ba_wang_zui', hook: 'chanRegenPerSec' as const, perLayer: 1 },
]

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

const drinkOnce = (engine: BattleEngine, a: Character, b: Character, buffId: string): void =>
    processActionEffect({ type: 'add_buff', buffId }, { self: a, enemy: b, engine, tMs: engine.state.turn.currentTime })

/** 该角色身上各层的 key（independent → 每层一个带 appId 的 key） */
function layerKeys(engine: BattleEngine, id: string, buffId: string): string[] {
    const out: string[] = []
    forEachBuffOf(engine.state.pendingBuffs, id, (_d, _l, bid, key) => {
        if (bid === buffId) out.push(key)
    })
    return out.sort()
}

const endTimes = (engine: BattleEngine, id: string, buffId: string): number[] =>
    layerKeys(engine, id, buffId)
        .map((k) => engine.state.turn.entries.find((e) => e.id === `buff_end_${k}`)?.nextActionAt ?? -1)
        .sort((x, y) => x - y)

for (const C of CASES) {
    describe(`${C.label} · independent 叠层`, () => {
        it('定义：independent、9 秒、每层贡献固定', () => {
            const buff = getBuff(C.buffId)!
            expect(buff.stacking).toEqual({ type: 'independent' })
            expect(buff.expiry).toEqual({ type: 'duration', ms: 9000 })
            const hook = buff[C.hook]!
            expect(hook({ layer: { restoreValue: 1 } } as never)).toBeCloseTo(C.perLayer)
        })

        it('每次饮用是自己一层、自己一条计时：3 次 = 3 层 3 条 buff_end', () => {
            const { engine, a, b } = setup()
            drinkOnce(engine, a, b, C.buffId)
            expect(layerKeys(engine, a.id, C.buffId).length).toBe(1)
            for (let i = 0; i < 40 && engine.state.turn.currentTime < 1000; i++) engine.runEvent(() => [])
            drinkOnce(engine, a, b, C.buffId)
            for (let i = 0; i < 40 && engine.state.turn.currentTime < 2000; i++) engine.runEvent(() => [])
            drinkOnce(engine, a, b, C.buffId)

            expect(layerKeys(engine, a.id, C.buffId).length).toBe(3)
            const times = endTimes(engine, a.id, C.buffId)
            expect(times.length).toBe(3)
            expect(new Set(times).size).toBe(3) // 三条计时互不相同
            expect(times[0]).toBeLessThan(times[2])
        })

        it('满 3 层后不再能喝（canUse 拦下，且不扣 AP）', () => {
            const { engine, a, b } = setup()
            for (let i = 0; i < 4; i++) drinkOnce(engine, a, b, C.buffId)
            expect(layerKeys(engine, a.id, C.buffId).length).toBe(4) // 直接 add_buff 绕过 canUse 仍会建层
            expect(getAction(C.actionId)!.canUse!(a, engine.state)).toBe(false)

            a.ap = a.maxAp
            const before = a.ap
            const keysBefore = layerKeys(engine, a.id, C.buffId).length
            engine.runEvent(() => [{ type: 'support', actionId: C.actionId }])
            expect(a.ap).toBe(before)
            expect(layerKeys(engine, a.id, C.buffId).length).toBe(keysBefore)
        })

        it('到期逐层掉：跑到第一条 buff_end 只少一层', () => {
            const { engine, a, b } = setup()
            drinkOnce(engine, a, b, C.buffId)
            while (engine.state.turn.currentTime < 1000) engine.runEvent(() => [])
            drinkOnce(engine, a, b, C.buffId)
            expect(layerKeys(engine, a.id, C.buffId).length).toBe(2)

            const first = endTimes(engine, a.id, C.buffId)[0]
            for (let i = 0; i < 2000 && engine.state.turn.currentTime <= first; i++) {
                if (!engine.runEvent(() => [])) break
            }
            expect(layerKeys(engine, a.id, C.buffId).length).toBe(1)
        })
    })
}

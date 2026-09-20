import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { getBuff } from '../../data/buffs'
import { ALL_ATTRS } from '../entities/attributes'
import type { BuffHookCtx } from '../../data/buffs/types'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

const purify = getBuff('auto_purify')!

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
    const engine = new BattleEngine(a, b, 4, false)
    processActionEffect({ type: 'add_buff', buffId: 'auto_purify' }, { self: a, enemy: b, engine, tMs: 0 })
    return { engine, a, b }
}

/** 直接问一次 tick 钩子（引擎把它当治疗量：>0 就 heal，见 processSystem 的 onTickHeal 分支） */
function tick(a: Character, engine: BattleEngine): number {
    const layer = engine.state.pendingBuffs.get(`auto_purify::${a.id}`)!
    return purify.onTickHeal!({
        final: 0,
        raw: 0,
        target: a,
        attacker: a,
        engine,
        state: engine.state,
        layer,
    } as BuffHookCtx)
}

describe('自动净化 · 每3秒一次，无负面回1气血', () => {
    it('节奏：tickInterval = 3000，建层即排 tick_buff 事件', () => {
        expect(purify.tickInterval).toBe(3000)
        expect(purify.description).toContain('每3秒')
        const { engine, a } = setup()
        const ev = engine.state.turn.entries.find((e) => e.id === `tick_buff_auto_purify::${a.id}`)
        expect(ev?.type).toBe('system')
        expect(ev?.nextActionAt).toBe(3000)
    })

    it('没有负面：返回 1（= 回 1 点气血），不净化任何东西', () => {
        const { engine, a } = setup()
        expect(tick(a, engine)).toBe(1)
    })

    it('有可净化负面：净化 1 层并返回 0（这一跳不回血）', () => {
        const { engine, a, b } = setup()
        // 断炁：additive、上限 3，正好观察「一跳只净化 1 层」
        processActionEffect({ type: 'add_debuff', buffId: 'duan_qi', stacks: 2, chance: 1 }, { self: b, enemy: a, engine, tMs: 0 })
        expect(engine.state.pendingBuffs.get(`duan_qi::${a.id}`)!.restoreValue).toBe(2)

        expect(tick(a, engine)).toBe(0)
        expect(engine.state.pendingBuffs.get(`duan_qi::${a.id}`)!.restoreValue).toBe(1)
        // 只净化 1 层，且这一跳不回血
        expect(tick(a, engine)).toBe(0)
        expect(engine.state.pendingBuffs.has(`duan_qi::${a.id}`)).toBe(false)
        // 负面清干净之后的那一跳才回血
        expect(tick(a, engine)).toBe(1)
    })

    it('真跑一跳：时钟推到 3 秒时确实回了 1 点气血', () => {
        const { engine, a } = setup()
        a.hp = a.maxHp - 10
        const before = a.hp
        // 双方都不出招，只为把时钟推过第一个 tick
        for (let i = 0; i < 2000 && engine.state.turn.currentTime < 3000; i++) {
            engine.runEvent(() => [])
        }
        expect(engine.state.turn.currentTime).toBeGreaterThanOrEqual(3000)
        expect(a.hp).toBe(before + 1)
    })
})

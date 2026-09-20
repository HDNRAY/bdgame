import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { Character } from '../entities/character'
import type { EffectDef } from '../entities/action'
import type { Reward } from '../../game/entities/reward'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

/**
 * 浮游眼（imperial 奇物）的防御效果：被施加「迷眼」时最多 1 层。
 *
 * 数据侧：
 *  - 奇物顶层 `effects` 走构造期层账；浮游眼 buff 的钩子由附着层承载
 *    （顶层 add_buff 也能物化 hooks，这里是历史写法）。
 *  - 浮游眼 buff 用 `onReceiveDebuff` 把 sand_blind 削减到 1 层（返回 >0 = 削减到该层数）。
 * 引擎侧：`onReceiveDebuff` 原先只实现了「返回 0 = 完全抵抗」，`>0 = 削减到该层数` 的文档语义没有落地，
 * 本次在 add_debuff 里补齐（取所有钩子里最小的结果）。
 */
const FLOATING_EYE: Reward = { type: 'artifact', id: 'floating_eye', name: '浮游眼', description: '', tags: [] }

function makeChar(id: string, rewards: Reward[]): Character {
    return new Character({
        id,
        name: id,
        weapon: 'peach_sword',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
        battleStyle: 'melee',
        rewards,
    })
}

function applyTo(engine: BattleEngine, eff: EffectDef, self: Character, enemy: Character): void {
    processActionEffect(eff, { self, enemy, engine, tMs: engine.state.eventTime })
}

describe('浮游眼 sand_blind 防御', () => {
    it('开局授予浮游眼 buff（洞察+4）', () => {
        const a = makeChar('a', [FLOATING_EYE])
        const b = makeChar('b', [])
        const engine = new BattleEngine(a, b, 4, true)

        expect(engine.state.pendingBuffs.has(`floating_eye_buff::${a.id}`)).toBe(true)
        expect(a.attrs.get('insight')).toBe(14)
    })

    it('被施加多层迷眼时削减到 1 层；没有浮游眼的一方照常吃满', () => {
        const a = makeChar('a', [FLOATING_EYE])
        const b = makeChar('b', [])
        const engine = new BattleEngine(a, b, 4, true)
        const sand: EffectDef = { type: 'add_debuff', buffId: 'sand_blind', stacks: 3, chance: 1 }

        // b 打 a：a 有浮游眼 → 只吃 1 层（洞察 14 - 4 = 10）
        applyTo(engine, sand, b, a)
        expect(engine.state.pendingBuffs.get(`sand_blind::${a.id}`)?.restoreValue).toBe(1)
        expect(a.attrs.get('insight')).toBe(10)

        // a 打 b：b 没有浮游眼 → 照常 3 层
        applyTo(engine, { ...sand }, a, b)
        expect(engine.state.pendingBuffs.get(`sand_blind::${b.id}`)?.restoreValue).toBe(3)
    })

    it('1 层迷眼不受影响（削减只在 stacks > 1 时生效）', () => {
        const a = makeChar('a', [FLOATING_EYE])
        const b = makeChar('b', [])
        const engine = new BattleEngine(a, b, 4, true)

        applyTo(engine, { type: 'add_debuff', buffId: 'sand_blind', stacks: 1, chance: 1 }, b, a)
        expect(engine.state.pendingBuffs.get(`sand_blind::${a.id}`)?.restoreValue).toBe(1)
        expect(a.attrs.get('insight')).toBe(10)
    })

    it('完全抵抗（返回 0）仍照旧：无明之明免疫迷眼', () => {
        const a = makeChar('a', [
            { type: 'passive', id: 'no_light_wisdom', name: '无明之明', description: '', tags: [] },
        ])
        const b = makeChar('b', [])
        const engine = new BattleEngine(a, b, 4, true)
        expect(engine.state.pendingBuffs.has(`no_light_buff::${a.id}`)).toBe(true)

        applyTo(engine, { type: 'add_debuff', buffId: 'sand_blind', stacks: 3, chance: 1 }, b, a)
        expect(engine.state.pendingBuffs.get(`sand_blind::${a.id}`)).toBeUndefined()
    })
})

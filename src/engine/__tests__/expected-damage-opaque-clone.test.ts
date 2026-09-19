import { describe, it, expect } from 'vitest'
import { BattleEngine } from '../combat/engine'
import { Character } from '../entities/character'
import { processActionEffect } from '../combat/effects/action'
import { calcExpectedDamage, EVAL_HOOKS } from '../ai/expected-damage'
import { DUOER } from '../../data/opponents/duoer'
import { JIRAN } from '../../data/opponents/jiran'
import { YIDAO } from '../../data/opponents/yidao'
import { gen } from '../../data/opponents/index'
import type { ActionDefinition } from '../entities/action'
import type { BattleState } from '../combat/types'
import type { RegisteredHook } from '../combat/utils/buff-registry'

/**
 * 不透明效果（`functional_damage` / `functional_heal`）的沙盒克隆口径回归测试。
 *
 * 背景（真实 bug）：受限克隆 `cloneForHooks + EVAL_HOOKS` 只复制「def 命中白名单钩子」的层。
 * 中毒层（`poison`）只带 `onDebuffApply`——那是施加时的单点回调，不进 hooks 桶——于是被整体漏掉；
 * `毒素引爆` 的 fn 按 key 直读 `poison::<目标>` 的 remainingTicks，拿到 undefined 就返回 0，
 * 期望伤害静默变成 0（实测 -1.6），AI 因此从不出这张牌（930 场 0 次）。
 *
 * 修法：含 fn 的招式退回全量克隆（fn 是任意代码，可直读任意层、可遍历某角色全部层）。
 */

function makeChar(def: Parameters<typeof gen>[0]): Character {
    return new Character(gen(def, 33))
}

interface Fixture {
    engine: BattleEngine
    atk: Character
    def: Character
    state: BattleState
}

/** duoer 打 yidao；stacks > 0 时给防守方上对应层数的中毒（走真实 add_debuff 路径，会写 remainingTicks） */
function makeFixture(stacks: number): Fixture {
    const atk = makeChar(DUOER)
    const def = makeChar(YIDAO)
    const engine = new BattleEngine(atk, def, 4, true)
    if (stacks > 0) {
        processActionEffect(
            { type: 'add_debuff', buffId: 'poison', stacks, chance: 1 },
            { self: atk, enemy: def, engine, tMs: 0 },
        )
    }
    return { engine, atk, def, state: engine.state }
}

function actionOf(c: Character, id: string): ActionDefinition {
    const a = c.actions.find((x) => x.id === id)
    if (!a) throw new Error(`${c.build.id} 没有招式 ${id}`)
    return a.def
}

/** 包一层 state，记录这次评估是否走了受限克隆（cloneForHooks） */
function spyClone(state: BattleState): { state: BattleState; usedHooks: () => boolean } {
    let used = false
    const patched = Object.create(state) as BattleState
    patched.cloneForHooks = (ids: readonly string[], hooks: readonly RegisteredHook[]) => {
        used = true
        return state.cloneForHooks(ids, hooks)
    }
    return { state: patched, usedHooks: () => used }
}

describe('期望伤害沙盒：不透明效果必须用全量克隆', () => {
    it('中毒层在受限克隆里会被漏掉（这就是必须全量克隆的原因）', () => {
        const { atk, def, state } = makeFixture(3)
        const key = `poison::${def.id}`
        // 至少 3 跳（duoer 身上有驭毒术/毒腺这类「施加中毒层数 +N」的放大器，实测会更多）
        const ticks = state.pendingBuffs.get(key)?.extra?.remainingTicks as number[]
        expect(ticks.length).toBeGreaterThanOrEqual(3)
        expect(ticks.every((t) => t > 0)).toBe(true)
        expect(state.cloneForHooks([atk.id, def.id], EVAL_HOOKS).pendingBuffs.get(key)).toBeUndefined()
        expect(state.cloneFor([atk.id, def.id]).pendingBuffs.get(key)).toBeDefined()
    })

    it('毒素引爆：目标有毒层时期望伤害为正，且随毒层数变化', () => {
        const withPoison = makeFixture(3)
        const action = actionOf(withPoison.atk, 'poison_detonate')
        const withEv = calcExpectedDamage(
            action,
            withPoison.atk,
            withPoison.def,
            withPoison.atk.getEffectiveRange(),
            withPoison.state,
        ).expectedDamage

        const noPoison = makeFixture(0)
        const withoutEv = calcExpectedDamage(
            action,
            noPoison.atk,
            noPoison.def,
            noPoison.atk.getEffectiveRange(),
            noPoison.state,
        ).expectedDamage

        // 修复前：有毒层也恒为 -1.6（层被沙盒漏掉 → fn 返回 0）
        expect(withEv).toBeGreaterThan(30)
        expect(withoutEv).toBeLessThan(0)
        expect(withEv - withoutEv).toBeGreaterThan(30)
    })

    it('含 fn 的招式绕开受限克隆，普通招式仍走受限克隆（性能优化未被整体回退）', () => {
        const { atk, def, state } = makeFixture(1)
        const opaque = spyClone(state)
        calcExpectedDamage(actionOf(atk, 'poison_detonate'), atk, def, atk.getEffectiveRange(), opaque.state)
        expect(opaque.usedHooks()).toBe(false)

        const plainId = atk.actions.find(
            (a) =>
                (a.def.effects ?? []).some((e) => e.type === 'damage') &&
                !(a.def.effects ?? []).some((e) => e.type === 'functional_damage' || e.type === 'functional_heal'),
        )?.id
        expect(plainId).toBeDefined()
        const ordinary = spyClone(state)
        calcExpectedDamage(actionOf(atk, plainId!), atk, def, atk.getEffectiveRange(), ordinary.state)
        expect(ordinary.usedHooks()).toBe(true)
    })

    it('按自身层数增伤的招式（jiran·如龙）同样走全量克隆', () => {
        const atk = makeChar(JIRAN)
        const def = makeChar(YIDAO)
        const engine = new BattleEngine(atk, def, 4, true)
        const spy = spyClone(engine.state)
        calcExpectedDamage(actionOf(atk, 'ru_long'), atk, def, atk.getEffectiveRange(), spy.state)
        expect(spy.usedHooks()).toBe(false)
    })
})

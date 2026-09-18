import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { calcExpectedDamage, EVAL_HOOKS } from '../ai/expected-damage'
import { forEachBuffOf } from '../combat/utils'
import { getBuff } from '../../data/buffs'
import { SANGYUAN } from '../../data/opponents/sangyuan'
import { TANGROU } from '../../data/opponents/tangrou'
import { YIDAO } from '../../data/opponents/yidao'
import { gen } from '../../data/opponents/index'
import type { ActionDefinition } from '../entities/action'
import type { CharacterBuild } from '../../game/entities/character-build'

/**
 * `DamageEstimate.apCost` 必须等于引擎真实扣费：
 * `cost = max(1, baseApCost + Σ onActionCost)` → `actionApCost`（身法/急速减免）。
 *
 * 回归点：`calcExpectedDamage` 原先只做 `actionApCost(action.apCost)`，**完全不算 onActionCost**，
 * 于是桑原（空手道）/唐柔（漫天花雨）/药屋花（明镜止水）/杨过（独臂·以力驭剑）这些人的招式
 * 在 planner 的效率排序里被系统性算贵（`rate = damage / (baseApCost + chanCostAp)`）。
 * 同时 `onActionCost` / `onHaste` 也必须进 `EVAL_HOOKS`，否则沙盒里根本没有这些层。
 */

/** 复刻引擎口径（engine.ts #executeAction / action-executor.canExecuteAction）：真源层上跑钩子 */
function engineApCost(atk: Character, foe: Character, action: ActionDefinition, state: BattleEngine['state']): number {
    let cost = action.apCost
    if (cost > 0) {
        forEachBuffOf(state.pendingBuffs, atk.id, (def, layer) => {
            if (!def?.onActionCost) return
            cost = Math.max(
                1,
                cost +
                    def.onActionCost({
                        final: 0,
                        raw: 0,
                        attacker: atk,
                        target: foe,
                        state,
                        layer,
                        source: action,
                    }),
            )
        })
    }
    return atk.actionApCost(cost, state)
}

describe('期望伤害的 AP 成本口径', () => {
    it('onActionCost / onHaste 都在评估白名单里（否则沙盒缺层、成本失真）', () => {
        expect(EVAL_HOOKS).toContain('onActionCost')
        expect(EVAL_HOOKS).toContain('onHaste')
    })

    it('空手道按招式 AP 取比例（文案「消耗-20%」）', () => {
        const hook = getBuff('karate')!.onActionCost!
        const ctx = (apCost: number, tags: string[]) =>
            ({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: { restoreValue: 1 }, source: { apCost, tags } as never })
        expect(hook(ctx(2, ['unarmed']))).toBeCloseTo(-0.4, 10)
        expect(hook(ctx(5, ['unarmed']))).toBeCloseTo(-1, 10)
        expect(hook(ctx(3, ['slash']))).toBe(0)
    })

    it('有 onActionCost 折扣的对手：est.apCost 与引擎实扣逐位相同', () => {
        let checked = 0
        for (const [who, label] of [
            [SANGYUAN, '桑原'],
            [TANGROU, '唐柔'],
        ] as const) {
            const atk = new Character(gen(who, 33))
            const foe = new Character(gen(YIDAO, 33))
            const engine = new BattleEngine(atk, foe, 4, true)
            for (const a of atk.actions) {
                if (a.def.apCost <= 0) continue
                // 只挑真的吃到折扣的招式（否则这条测试退化成"两边都是原价"）
                const real = engineApCost(atk, foe, a.def, engine.state)
                if (real >= atk.actionApCost(a.def.apCost, engine.state)) continue
                const est = calcExpectedDamage(a.def, atk, foe, atk.getEffectiveRange(), engine.state)
                expect(est.apCost, `${label} ${a.def.name}`).toBeCloseTo(real, 10)
                expect(est.apCost).toBeLessThan(atk.actionApCost(a.def.apCost, engine.state))
                checked++
            }
        }
        expect(checked).toBeGreaterThan(0)
    })

    it('0 成本招式天然免费，不走折扣', () => {
        const atk = new Character(gen(SANGYUAN, 33))
        const foe = new Character(gen(YIDAO, 33))
        const engine = new BattleEngine(atk, foe, 4, true)
        const zero = atk.actions.find((a) => a.def.apCost <= 0)
        if (zero) {
            const est = calcExpectedDamage(zero.def, atk, foe, atk.getEffectiveRange(), engine.state)
            expect(est.apCost).toBeLessThanOrEqual(0)
        }
    })

    it('有状态钩子（分心错手写 firstActionDone）只在沙盒里生效，不污染真源', () => {
        const build: CharacterBuild = {
            id: 't',
            name: 't',
            story: 'balanced',
            weapon: 'bare_hands',
            // 灵巧 18 + 推演 ≤4 → 自动解锁天赋「分心错手」
            baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 18, insight: 10, wisdom: 4 },
            battleStyle: 'clinch',
            rewards: [{ id: 'straight_punch', name: '直拳', type: 'action', description: '', tags: [] }],
        }
        const atk = new Character(build)
        const foe = new Character(gen(YIDAO, 33))
        const engine = new BattleEngine(atk, foe, 4, true)
        const key = `zuoyou_hubo::${atk.id}`
        const real = engine.state.pendingBuffs.get(key)
        expect(real, '分心错手天赋应已解锁').toBeDefined()
        expect(real!.extra?.firstActionDone).toBeUndefined()

        const act = atk.actions.find((a) => a.def.apCost > 0)
        expect(act, '应当有可用的非零 AP 招式').toBeDefined()
        calcExpectedDamage(act!.def, atk, foe, atk.getEffectiveRange(), engine.state)

        expect(engine.state.pendingBuffs.get(key)!.extra?.firstActionDone).toBeUndefined()
    })
})

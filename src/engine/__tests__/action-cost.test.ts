import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { calcExpectedDamage, EVAL_HOOKS } from '../ai/expected-damage'
import { forEachBuffOf, calcActionChanCost } from '../combat/utils'
import { getBuff } from '../../data/buffs'
import { SANGYUAN } from '../../data/opponents/sangyuan'
import { TANGROU } from '../../data/opponents/tangrou'
import { XIAOHUA } from '../../data/opponents/xiaohua'
import { YIDAO } from '../../data/opponents/yidao'
import { gen } from '../../data/opponents/index'
import type { ActionDefinition } from '../entities/action'
import type { CharacterBuild } from '../../game/entities/character-build'

/**
 * 招式成本口径：`DamageEstimate.apCost` / `.chanCost` 必须等于引擎真实扣费。
 *
 * AP：
 * `cost = max(1, baseApCost + Σ onActionCost)` → `actionApCost`（身法/急速减免）。
 *
 * 回归点：`calcExpectedDamage` 原先只做 `actionApCost(action.apCost)`，**完全不算 onActionCost**，
 * 于是桑原（空手道）/唐柔（漫天花雨）/药屋花（明镜止水）/杨过（独臂·以力驭剑）这些人的招式
 * 在 planner 的效率排序里被系统性算贵（`rate = damage / (baseApCost + chanCostAp)`）。
 * 同时 `onActionCost` / `onHaste` 也必须进 `EVAL_HOOKS`，否则沙盒里根本没有这些层。
 *
 * 缠劲：`calcActionChanCost()` 是与 onActionCost 同构的唯一入口（主招 / 前后摇辅助招 / AI 估算 /
 * 可行性检查全走它），`onActionChanCost` 同样要在 EVAL_HOOKS 里。
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

describe('招式成本口径（AP / 缠劲）', () => {
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

    // ── 缠劲 ──
    it('onActionChanCost 在评估白名单里', () => {
        expect(EVAL_HOOKS).toContain('onActionChanCost')
    })

    it('明镜止水：AP 与缠劲各 -15%，0 缠招式不受影响', () => {
        const buff = getBuff('mingjing_zhishui_buff')!
        const ctx = (apCost: number, chanCost: number) =>
            ({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: { restoreValue: 1 }, source: { apCost, chanCost } as never })
        expect(buff.onActionCost!(ctx(4, 20))).toBeCloseTo(-0.6, 10)
        expect(buff.onActionChanCost!(ctx(4, 20))).toBeCloseTo(-3, 10)
        expect(buff.onActionChanCost!(ctx(4, 0))).toBe(0)
    })

    it('药屋花·三寸光：est.chanCost = 17（20 缠 -15%），与引擎扣费一致', () => {
        const build = gen(XIAOHUA, 33)
        const without = { ...build, rewards: build.rewards.filter((r) => r.id !== 'mingjing_zhishui') }
        const probe = (b: typeof build) => {
            const atk = new Character(b)
            const foe = new Character(gen(YIDAO, 33))
            const engine = new BattleEngine(atk, foe, 4, true)
            const act = atk.actions.find((a) => a.id === 'three_inch_light')!
            return {
                realChan: calcActionChanCost(engine.state, atk, act.def, foe),
                est: calcExpectedDamage(act.def, atk, foe, atk.getEffectiveRange(), engine.state),
            }
        }
        const on = probe(build)
        expect(on.realChan, '带明镜止水').toBe(17)
        expect(on.est.chanCost).toBe(17)
        const off = probe(without)
        expect(off.realChan, '摘掉明镜止水').toBe(20)
        expect(off.est.chanCost).toBe(20)
    })

    it('缠劲折扣 clamp 到 0，不会倒赚缠劲', () => {
        const def = getBuff('mingjing_zhishui_buff')!
        const saved = def.onActionChanCost
        try {
            def.onActionChanCost = ({ source }) => -(((source as ActionDefinition).chanCost ?? 0) * 2)
            const atk = new Character(gen(XIAOHUA, 33))
            const foe = new Character(gen(YIDAO, 33))
            const engine = new BattleEngine(atk, foe, 4, true)
            const act = atk.actions.find((a) => a.id === 'three_inch_light')!
            expect(calcActionChanCost(engine.state, atk, act.def, foe)).toBe(0)
        } finally {
            def.onActionChanCost = saved
        }
    })
})

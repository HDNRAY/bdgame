import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { calcExpectedDamage, EVAL_HOOKS } from '../ai/expected-damage'
import { OPPONENTS, gen } from '../../data/opponents/index'
import { getBuff } from '../../data/buffs'
import type { BattleState } from '../combat/types'
import type { BuffDef } from '../../data/buffs/types'
import type { RegisteredHook } from '../combat/utils/buff-registry'

/**
 * 一致性测试：受限克隆（cloneForHooks + EVAL_HOOKS 白名单）与全量克隆（cloneFor）下，
 * calcExpectedDamage 的输出必须逐位相同。两边都用「原型打补丁」显式指定口径，
 * 与生产路径当前用哪个无关（生产用受限克隆，含 `functional_*` 的招式例外，见 expected-damage.ts）。
 *
 * 注意本测试的局限：**开局状态没有 DoT 层**，所以「层被白名单漏掉」这类失真测不出来
 * （真实 bug：中毒层只带 onDebuffApply、不进 hooks 桶，被整层漏掉）——
 * 那一类由 `expected-damage-opaque-clone.test.ts` 覆盖。
 *
 * 覆盖：全部 32 个对手各挑 3 个目标（共 96 对），每对跑攻方全部招式，比较
 * expectedDamage / hitChance / canReach / apCost。
 *
 * 钩子里有 Math.random（部分 onDealDamage / onDebuffApplied 等），故测试期间用固定种子伪随机
 * 替换 Math.random，并在每次评估前重置种子，保证两路口径看到同一串随机数、差异只可能来自克隆范围。
 */
let randSeed = 0
/** 线性同余伪随机，返回 [0,1)（与 Math.random 同范围） */
function seededRandom(): number {
    randSeed = (randSeed * 1664525 + 1013904223) >>> 0
    return randSeed / 0x100000000
}
const SEED0 = 20240101

/** 与真 state 同原型，但把 cloneForHooks 退回全量 cloneFor ——「全量克隆」口径 */
function fullCloneState(state: BattleState): BattleState {
    const patched = Object.create(state) as BattleState
    patched.cloneForHooks = (ids: readonly string[]) => state.cloneFor(ids)
    return patched
}

/** 与真 state 同原型，但把 cloneForHooks 固定成受限克隆 ——「受限克隆」口径（与生产用哪个无关） */
function restrictedCloneState(state: BattleState): BattleState {
    const patched = Object.create(state) as BattleState
    patched.cloneForHooks = (ids: readonly string[]) => state.cloneForHooks(ids, EVAL_HOOKS)
    return patched
}

/** def 是否命中任一白名单钩子（与 BuffRegistry 按桶复制的过滤条件同义） */
function hitsHook(def: BuffDef | undefined): boolean {
    if (!def) return false
    return EVAL_HOOKS.some((h: RegisteredHook) => typeof def[h] === 'function')
}

/** 真源里「属于这些角色且命中白名单」的层 key 集合（受限克隆应当精确等于它） */
function expectedSelectedKeys(state: BattleState, ids: readonly string[]): Set<string> {
    const out = new Set<string>()
    for (const id of ids) {
        for (const key of state.pendingBuffs.keysOfOwner(id)) {
            const buffId = key.slice(0, key.indexOf('::'))
            if (hitsHook(getBuff(buffId))) out.add(key)
        }
    }
    return out
}

describe('expected-damage 受限克隆一致性', () => {
    beforeAll(() => {
        vi.spyOn(Math, 'random').mockImplementation(seededRandom)
    })
    afterAll(() => {
        vi.restoreAllMocks()
    })

    it('32 个对手 x 3 目标 x 全部招式：受限克隆与全量克隆输出完全相等', () => {
        expect(OPPONENTS.length).toBe(32)
        let combos = 0
        let actionsChecked = 0
        const mismatches: string[] = []

        for (let i = 0; i < OPPONENTS.length; i++) {
            const atkDef = OPPONENTS[i]
            // 目标取 3 个不同对手（偏移 1/11/21 覆盖拳掌/刀剑/远程/巨武等不同武器与 buff 池）
            const targets = [
                OPPONENTS[(i + 1) % OPPONENTS.length],
                OPPONENTS[(i + 11) % OPPONENTS.length],
                OPPONENTS[(i + 21) % OPPONENTS.length],
            ]
            for (const defDef of targets) {
                randSeed = SEED0 + i
                const atk = new Character(gen(atkDef, 33))
                const def = new Character(gen(defDef, 33))
                randSeed = SEED0 + i
                const engine = new BattleEngine(atk, def, 4)
                const state = engine.state
                const fullState = fullCloneState(state)
                const restrictedState = restrictedCloneState(state)
                const ids = [atk.id, def.id]

                // 不变式一：受限克隆的层集合，精确等于真源里命中白名单的层集合
                const restrictedKeys = new Set(state.cloneForHooks(ids, EVAL_HOOKS).pendingBuffs.keys())
                expect(restrictedKeys).toEqual(expectedSelectedKeys(state, ids))

                const range = atk.getEffectiveRange()
                for (const action of atk.actions) {
                    randSeed = SEED0 + i
                    const restricted = calcExpectedDamage(action.def, atk, def, range, restrictedState)
                    randSeed = SEED0 + i
                    const baseline = calcExpectedDamage(action.def, atk, def, range, fullState)
                    actionsChecked++
                    if (
                        restricted.expectedDamage !== baseline.expectedDamage ||
                        restricted.hitChance !== baseline.hitChance ||
                        restricted.canReach !== baseline.canReach ||
                        restricted.apCost !== baseline.apCost
                    ) {
                        mismatches.push(
                            `${atkDef.id}->${defDef.id} ${action.id}: ` +
                                `expected ${restricted.expectedDamage}/${baseline.expectedDamage} ` +
                                `hit ${restricted.hitChance}/${baseline.hitChance} ` +
                                `reach ${restricted.canReach}/${baseline.canReach} ` +
                                `ap ${restricted.apCost}/${baseline.apCost}`,
                        )
                    }
                }
                combos++
            }
        }

        expect(actionsChecked).toBeGreaterThan(500)
        expect(combos).toBe(96)
        // 有任何一处不一致就整体失败，并打印全部差异（便于定位漏掉的钩子）
        expect(mismatches).toEqual([])
    })
})

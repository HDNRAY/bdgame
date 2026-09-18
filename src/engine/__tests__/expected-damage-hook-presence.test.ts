import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { calcExpectedDamage, EVAL_HOOKS } from '../ai/expected-damage'
import { OPPONENTS, gen } from '../../data/opponents/index'
import { forEachBuffOf } from '../combat/utils'
import { BuffRegistry, buffPresence, hookMaskOf } from '../combat/utils/buff-registry'
import type { HookPresence, RegisteredHook } from '../combat/utils/buff-registry'
import { BUFF_DB, DEBUFF_DB } from '../../data/buffs'
import { rng } from '../util/rng'
import type { BuffDef } from '../../data/buffs/types'
import type { BuffLayer, BattleState } from '../combat/types'

/**
 * 钩子存在性位图（expected-damage 评估守卫）的两条不变式：
 *
 *  1. 正确性：presenceOf 报「存在」当且仅当逐层扫描（forEachBuffOf，与守卫跳过的扫描同源）能找到该钩子。
 *     —— 漏报会让守卫跳过本该执行的钩子（行为变化），误报只是少跳过（性能）。
 *  2. 零行为变化：把 presenceOf 强制成「全部钩子都存在」（= 优化前每处都扫），
 *     96 组对手 x 3 目标 x 攻方全部招式的五个输出必须与带守卫版逐值相同。
 *
 * 取样与 expected-damage-clone-parity.test.ts 相同（32 对手各挑 3 目标），随机数同样固定种子：
 * Math.random 走 LCG 补丁，rng 走 seedMain（钩子内两种骰子都有），故两路口径看到同一串随机数。
 */
let randSeed = 0
/** 线性同余伪随机，返回 [0,1)（与 Math.random 同范围） */
function seededRandom(): number {
    randSeed = (randSeed * 1664525 + 1013904223) >>> 0
    return randSeed / 0x100000000
}
const SEED0 = 20240101

/** 每路评估前把两种随机源都拨回同一起点 */
function resetRandom(seed: number): void {
    randSeed = seed
    rng.seedMain(seed)
}

interface Matchup {
    atkId: string
    defId: string
    atk: Character
    def: Character
    state: BattleState
    range: [number, number]
}

/** 96 组对局现场（32 对手各挑 3 个目标，与 clone-parity 测试同构造） */
function buildMatchups(): Matchup[] {
    const out: Matchup[] = []
    for (let i = 0; i < OPPONENTS.length; i++) {
        const atkDef = OPPONENTS[i]
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
            out.push({
                atkId: atkDef.id,
                defId: defDef.id,
                atk,
                def,
                state: engine.state,
                range: atk.getEffectiveRange(),
            })
        }
    }
    return out
}

/** def 是否拥有某注册钩子 */
function defHasHook(def: BuffDef | undefined, hook: RegisteredHook): boolean {
    return !!def && typeof def[hook] === 'function'
}

/** 真值：这些角色的层里是否有任意一层带该钩子（与守卫跳过的扫描同源） */
function hookPresentInLayers(state: BattleState, ids: readonly string[], hook: RegisteredHook): boolean {
    let found = false
    forEachBuffOf(state.pendingBuffs, ids, (def) => {
        if (defHasHook(def, hook)) {
            found = true
            return false
        }
        return undefined
    })
    return found
}

/** 评估输出的五个数值字段（canReach 转 0/1 便于逐值比较） */
function estimateRow(r: ReturnType<typeof calcExpectedDamage>): number[] {
    return [r.rawDamage, r.expectedDamage, r.hitChance, r.canReach ? 1 : 0, r.apCost]
}

describe('expected-damage 钩子存在性位图', () => {
    beforeAll(() => {
        vi.spyOn(Math, 'random').mockImplementation(seededRandom)
    })
    afterAll(() => {
        rng.resetMain()
        vi.restoreAllMocks()
    })

    it('presenceOf 与逐层扫描真值逐钩子一致（无漏报、无误报），且确实存在可整段跳过的组合', () => {
        const matchups = buildMatchups()
        expect(OPPONENTS.length).toBe(32)
        expect(matchups.length).toBe(96)

        const unionMask = hookMaskOf(EVAL_HOOKS)
        const absentPerHook = new Map<RegisteredHook, number>()
        let hookHitCombos = 0
        let absentPairs = 0

        for (const m of matchups) {
            const ids = [m.atkId, m.defId]
            // 守卫读的是评估沙盒（cloneFor）的层，故真值也在沙盒上取
            const sandbox = m.state.cloneFor(ids)
            const present = sandbox.pendingBuffs.presenceOf(ids)

            for (const hook of EVAL_HOOKS) {
                const truth = hookPresentInLayers(sandbox, ids, hook)
                expect(present.has(hook), `${m.atkId}->${m.defId} ${hook}`).toBe(truth)
                // hasAny(单钩子掩码) 必须与 has 同解
                expect(present.hasAny(hookMaskOf([hook]))).toBe(present.has(hook))
                if (!truth) {
                    absentPerHook.set(hook, (absentPerHook.get(hook) ?? 0) + 1)
                    absentPairs++
                }
            }
            const anyHook = EVAL_HOOKS.some((h) => present.has(h))
            expect(present.hasAny(unionMask)).toBe(anyHook)
            if (anyHook) hookHitCombos++
        }

        // 样本确实覆盖了两条分支：既有钩子齐全的组合，也有「某钩子在全部组合里都不存在」的钩子
        // （后者说明守卫在这些组合上真的整段跳过了扫描），且缺席比例过半（实测 1130/1824 = 62%）
        expect(hookHitCombos).toBeGreaterThan(0)
        expect(Math.max(...absentPerHook.values())).toBeGreaterThan(0)
        expect(absentPairs * 2).toBeGreaterThan(EVAL_HOOKS.length * matchups.length)
    })

    it('96 组 x 全部招式：带守卫与不守卫（presenceOf 恒为真）输出逐值相等', () => {
        const matchups = buildMatchups()
        const allPresent: HookPresence = { has: () => true, hasAny: () => true }
        const mismatches: string[] = []
        let actionsChecked = 0

        for (let i = 0; i < matchups.length; i++) {
            const m = matchups[i]
            const seed = SEED0 + (i % OPPONENTS.length)
            const unguarded: number[][] = []
            const guarded: number[][] = []
            const actionIds: string[] = []

            // 第一路：presenceOf 恒为真 == 优化前语义（每处扫描都执行）
            const spy = vi.spyOn(BuffRegistry.prototype, 'presenceOf').mockReturnValue(allPresent)
            try {
                for (const action of m.atk.actions) {
                    resetRandom(seed)
                    unguarded.push(estimateRow(calcExpectedDamage(action.def, m.atk, m.def, m.range, m.state)))
                }
            } finally {
                spy.mockRestore()
            }

            // 第二路：真实存在性位图（守卫生效）
            for (const action of m.atk.actions) {
                resetRandom(seed)
                guarded.push(estimateRow(calcExpectedDamage(action.def, m.atk, m.def, m.range, m.state)))
                actionIds.push(action.id)
            }
            rng.resetMain()

            for (let k = 0; k < guarded.length; k++) {
                actionsChecked++
                if (estimateRowDiffers(guarded[k], unguarded[k])) {
                    mismatches.push(
                        `${m.atkId}->${m.defId} ${actionIds[k]}: 守卫 ${guarded[k].join('/')} vs 无守卫 ${unguarded[k].join('/')}`,
                    )
                }
            }
        }

        expect(actionsChecked).toBeGreaterThan(500)
        expect(mismatches).toEqual([])
    })

    it('层增删后存在性视图自动失效；裸 Map 兜底为全放行', () => {
        const ids = ['a', 'b']
        const registry = new BuffRegistry()
        // 视图先建、后改层：验证它按结构 revision 惰性失效，而不是建视图时快照一次
        const present = registry.presenceOf(ids)
        const dealDef = [...BUFF_DB, ...DEBUFF_DB].find((d) => defHasHook(d, 'onDealDamage'))
        expect(dealDef).toBeDefined()
        if (!dealDef) return

        expect(present.has('onDealDamage')).toBe(false)
        // 裸 set（hooks 桶不登记）也必须被看见：存在性走 byOwner + getBuff，与 forEachBuffOf 同源
        const key = `${dealDef.id}::a`
        const layer: BuffLayer = { restoreValue: 1 }
        registry.set(key, layer)
        expect(present.has('onDealDamage')).toBe(true)
        registry.delete(key)
        expect(present.has('onDealDamage')).toBe(false)

        // 非 BuffRegistry 的裸 Map：无索引可查，保守全放行（语义与优化前一致）
        const fallback = buffPresence(new Map(), ids)
        expect(fallback.has('onDealDamage')).toBe(true)
        expect(fallback.hasAny(hookMaskOf(['onDealDamage']))).toBe(true)
    })
})

/** 五个输出字段是否有任一不同 */
function estimateRowDiffers(a: number[], b: number[]): boolean {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true
    return false
}

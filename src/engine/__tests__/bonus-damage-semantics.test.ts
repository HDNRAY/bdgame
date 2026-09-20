import { describe, it, expect, vi, afterEach , beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { getBuff } from '../../data/buffs'
import { ALL_ATTRS } from '../entities/attributes'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

/**
 * `onAfterDealDamage` 返回 `{ normal, piercing }` 时，`normal` 是**总额**、
 * `piercing` 是其中无视减免的那部分 —— 与 `onPostCritDamage` / `onDealDamage` 同口径。
 *
 * 回归点：这个钩子原先按「两笔相加」解释（`raw = normal`，穿透再额外加一笔），
 * 同一形状在两个钩子里语义相反。改口径后数据同步成 `{ normal: 2, piercing: 1 }`，
 * 雷法/特种兵匕首的实际伤害保持"共 2 点、其中 1 点穿透"不变。
 */
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
afterEach(() => vi.restoreAllMocks())

/** 打一击固定 6 点，返回目标掉的血（命中/暴击全部钉死，只看总额） */
function hpDrop(withThunder: boolean): number {
    vi.spyOn(Math, 'random').mockReturnValue(0.9) // 不暴击
    const atk = makeChar('A')
    const def = makeChar('B')
    const engine = new BattleEngine(atk, def, 4, true)
    if (withThunder) {
        processActionEffect({ type: 'add_buff', buffId: 'thunder_bonus' }, { self: atk, enemy: def, engine, tMs: 0 })
        atk.addChan(10) // 雷法要耗 1 缠，否则不触发
    }
    const before = def.hp
    processActionEffect({ type: 'damage', fixed: 6 }, { self: atk, enemy: def, engine, tMs: 0 })
    return before - def.hp
}

describe('追加伤害 { normal, piercing } 的口径', () => {
    it('雷法/特种兵匕首：normal 是总额，piercing 只是其中那部分', () => {
        const atk = makeChar('A')
        atk.addChan(10)
        const r = getBuff('thunder_bonus')!.onAfterDealDamage!({ attacker: atk } as never) as {
            normal: number
            piercing: number
        }
        // 钉的是形状与关系，不是具体点数（点数随平衡调整：曾经 2，现在 3）
        expect(r.piercing).toBeGreaterThan(0)
        expect(r.piercing).toBeLessThanOrEqual(r.normal)
        expect(getBuff('special_forces_dagger')!.onAfterDealDamage).toBeTypeOf('function')
    })

    it('雷法：实际多掉的血 = normal（不是 normal+piercing）', () => {
        const withThunder = hpDrop(true)
        const without = hpDrop(false)
        expect(without).toBeGreaterThan(0)
        const atk = makeChar('A')
        atk.addChan(10)
        const r = getBuff('thunder_bonus')!.onAfterDealDamage!({ attacker: atk } as never) as { normal: number }
        expect(withThunder - without).toBe(r.normal)
    })
})

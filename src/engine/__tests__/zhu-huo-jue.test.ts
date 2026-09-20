import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getAction } from '../../data/actions'
import { calcEffectiveCritChance } from '../combat/utils'
import { rng } from '../util/rng'

function makeChar(id: string, name: string, dexterity: number, insight: number): Character {
    return new Character({
        id,
        name,
        weapon: 'peach_sword',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity, insight, wisdom: 8 },
        battleStyle: 'melee' as const,
        rewards: [],
    })
}

const buff = getBuff('zhu_huo_jue_buff')!
const MOVE = getAction('blaze_strike')!

function setup(dexterity = 14, insight = 20) {
    const atk = makeChar('A', '甲', dexterity, insight)
    const foe = makeChar('B', '乙', 10, 10)
    const engine = new BattleEngine(atk, foe, 4, false)
    return { atk, foe, state: engine.state, engine }
}

/** 施加一次灼烧（引擎 add_debuff 成功后调用 onDebuffApplied） */
function applyBurn(
    ctx: ReturnType<typeof setup>,
    layer: { restoreValue: number },
    move?: ReturnType<typeof getAction>,
): void {
    buff.onDebuffApplied!({
        layer,
        self: ctx.atk,
        enemy: ctx.foe,
        state: ctx.state,
        engine: ctx.engine,
        buffId: 'burn',
        stacks: 1,
        source: move,
    } as never)
}

describe('铸火诀 · 铸火', () => {
    it('定义：走「施加灼烧时判定」，不走暴击事件', () => {
        expect(buff.onCritical).toBeUndefined()
        expect(buff.onDebuffApplied).toBeTypeOf('function')
        expect(buff.onDebuffTick).toBeTypeOf('function') // 自身受灼烧减半保留
    })

    it('每次施加：独立判定 1 + floor(灵巧/6) 次，每次以暴击率为概率 +1 层', () => {
        const ctx = setup(14, 20) // 灵巧 14 → 1 + 2 = 判定 3 次
        const crit = calcEffectiveCritChance(ctx.state, ctx.atk, ctx.foe, MOVE)
        const rolls = 1 + Math.floor(ctx.atk.attrs.get('dexterity') / 6)
        expect(rolls).toBe(3)
        expect(crit).toBeGreaterThan(0)

        rng.seedMain(123)
        const N = 4000
        let total = 0
        let maxOne = 0
        for (let i = 0; i < N; i++) {
            const layer = { restoreValue: 0 }
            applyBurn(ctx, layer, MOVE)
            total += layer.restoreValue
            if (layer.restoreValue > maxOne) maxOne = layer.restoreValue
        }
        expect(total / N).toBeCloseTo(rolls * crit, 1) // 期望 = 判定次数 × 实时暴击率
        expect(maxOne).toBeLessThanOrEqual(rolls)
        expect(maxOne).toBe(rolls) // 4000 次里必定出现过全中
    })

    it('实时口径：身上有暴击 buff（心眼 +25%）时期望增量变大', () => {
        const plain = setup(14, 20)
        const buffed = setup(14, 20)
        buffed.state.pendingBuffs.set(`mind_eye::${buffed.atk.id}`, { restoreValue: 1, buffId: 'mind_eye' })
        const avg = (ctx: ReturnType<typeof setup>) => {
            rng.seedMain(99)
            let total = 0
            for (let i = 0; i < 3000; i++) {
                const layer = { restoreValue: 0 }
                applyBurn(ctx, layer, MOVE)
                total += layer.restoreValue
            }
            return total / 3000
        }
        expect(avg(buffed)).toBeGreaterThan(avg(plain))
    })

    it('灵巧不足 6 点仍有 1 次判定（不是不判定）', () => {
        const ctx = setup(5, 20)
        const crit = calcEffectiveCritChance(ctx.state, ctx.atk, ctx.foe, MOVE)
        rng.seedMain(1)
        let total = 0
        let maxOne = 0
        const N = 2000
        for (let i = 0; i < N; i++) {
            const layer = { restoreValue: 0 }
            applyBurn(ctx, layer, MOVE)
            total += layer.restoreValue
            if (layer.restoreValue > maxOne) maxOne = layer.restoreValue
        }
        expect(maxOne).toBe(1) // 只能 +1（1 次判定）
        expect(total / N).toBeCloseTo(crit, 1)
    })
})

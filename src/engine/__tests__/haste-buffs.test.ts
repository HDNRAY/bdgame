import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { runBattle } from '../battle-runner'
import { getBuff } from '../../data/buffs'
import { calcApCostReduction, calcActionCostAfterSpeed, SPEED_AP_COST_CAP } from '../calc/damage'
import type { BuffLayer } from '../combat/types'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { Reward } from '../../game/entities/reward'

/**
 * 急速改成「与身法同刻度」（1 点 = 1%），数值整体 ÷10；
 * 急速不再是一种 EffectDef，全部由 buff 的 onHaste 钩子承载。
 *
 * 注意：这里只钉**机制**（同刻度、共享上限、每个 buff 的钩子形状），不钉具体数值 ——
 * 数值是可调平衡项，改了不该让测试变红。
 */
function makeChar(id: string, attrs: Partial<Record<string, number>> = {}, rewards: Reward[] = []): Character {
    return new Character({
        id,
        name: id,
        weapon: 'bare_hands',
        baseAttrs: {
            strength: 10,
            vitality: 10,
            agility: 10,
            dexterity: 10,
            insight: 10,
            wisdom: 10,
            ...attrs,
        } as CharacterBuild['baseAttrs'],
        battleStyle: 'clinch',
        rewards,
    })
}

const passive = (id: string): Reward => ({ type: 'passive', id, name: id, description: '', tags: [] })

/** 取某个 buff 的 onHaste 在给定层数/角色下返回多少 */
function onHasteOf(buffId: string, stacks: number, target?: Character): number {
    const buff = getBuff(buffId)!
    expect(buff.onHaste, `${buffId} 应该有 onHaste`).toBeTypeOf('function')
    const layer = { restoreValue: stacks } as BuffLayer
    return buff.onHaste!({ layer, target: target ?? makeChar('x'), attacker: target ?? makeChar('y') } as never)
}

describe('急速与身法同刻度', () => {
    it('1 点 = 1%：20 急速就等于原来 200 急速的效果（20% 减免）', () => {
        expect(calcApCostReduction(0, 20)).toBeCloseTo(0.2)
        expect(calcApCostReduction(20, 0)).toBeCloseTo(0.2)
        expect(calcApCostReduction(20, 16)).toBeCloseTo(0.36)
    })

    it('两者共享 40% 上限', () => {
        expect(calcApCostReduction(30, 20)).toBeCloseTo(SPEED_AP_COST_CAP)
        expect(calcApCostReduction(20, 40)).toBeCloseTo(SPEED_AP_COST_CAP)
    })
})

describe('急速全部由 buff 承载', () => {
    it('凌波微步 / 风切：固定值（与推演无关）且为正', () => {
        const low = makeChar('A', { wisdom: 4 })
        const high = makeChar('B', { wisdom: 20 })
        for (const id of ['ling_bo_wei_bu_buff', 'ninja_sword_haste']) {
            const v = onHasteOf(id, 1, low)
            expect(v, id).toBeGreaterThan(0)
            expect(onHasteOf(id, 1, high), id).toBeCloseTo(v) // 不吃推演
        }
    })

    it('追星：与层数成正比', () => {
        expect(onHasteOf('zhuixing', 2)).toBeCloseTo(onHasteOf('zhuixing', 1) * 2)
    })

    it('神行百变：实时读推演（推演越高急速越高；斜率是可调平衡项，不写死）', () => {
        const a = onHasteOf('shenxing_baibian_buff', 1, makeChar('A', { wisdom: 8 }))
        const b = onHasteOf('shenxing_baibian_buff', 1, makeChar('B', { wisdom: 12 }))
        const c = onHasteOf('shenxing_baibian_buff', 1, makeChar('C', { wisdom: 20 }))
        expect(a).toBeGreaterThan(0)
        expect(b).toBeGreaterThan(a)
        expect(c).toBeGreaterThan(b)
    })

    it('战斗里真的挂上、并且真的减免招式成本（凌波微步 / 风切）', () => {
        const viaTalent = runBattle(makeChar('A', { agility: 20 }, [passive('ling_bo_wei_bu')]), makeChar('B'), undefined, 4, true)
        const self = viaTalent.engine.state.characters[0]
        expect(viaTalent.engine.state.pendingBuffs.has(`ling_bo_wei_bu_buff::${self.id}`)).toBe(true)
        const haste = self.getHaste(viaTalent.engine.state)
        expect(haste).toBeGreaterThan(0)
        expect(calcActionCostAfterSpeed(4, self.attrs.get('agility'), haste)).toBeLessThan(4)

        const viaWeapon = runBattle(new Character({ ...makeChar('A').build, weapon: 'ninja_sword' }), makeChar('B'), undefined, 4, true)
        const w = viaWeapon.engine.state.characters[0]
        expect(viaWeapon.engine.state.pendingBuffs.has(`ninja_sword_haste::${w.id}`)).toBe(true)
        expect(w.getHaste(viaWeapon.engine.state)).toBeGreaterThan(0)
    })

    it('急速只来自 buff：没有 state 时算 0，开战后由钩子层提供', () => {
        const c = makeChar('A', { agility: 20 }, [passive('ling_bo_wei_bu')])
        expect(c.getHaste()).toBe(0) // 构造期不再有 flat 急速
        const engine = new BattleEngine(c, makeChar('B'), 4)
        expect(c.getHaste(engine.state)).toBeGreaterThan(0) // battle_start 的 buff 已挂
    })
})

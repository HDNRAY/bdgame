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
 * 急速改成「与身法同刻度」（1 点 = 1%），数值整体 ÷10：
 * 20 急速 = 原来 200 急速的效果。急速不再是一种 EffectDef，全部由 buff 的 onHaste 钩子承载。
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
    it('1 点 = 1%：20 急速就等于原来 200 急速的效果', () => {
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
    it('数值：凌波微步 16 / 风切 12 / 追星每层 4 / 神行百变 10+推演÷2', () => {
        expect(onHasteOf('ling_bo_wei_bu_buff', 1)).toBe(16)
        expect(onHasteOf('ninja_sword_haste', 1)).toBe(12)
        expect(onHasteOf('zhuixing', 1)).toBe(4)
        expect(onHasteOf('zhuixing', 2)).toBe(8)
        const c = makeChar('A', { wisdom: 20 })
        expect(onHasteOf('shenxing_baibian_buff', 1, c)).toBeCloseTo(20)
        const c2 = makeChar('A', { wisdom: 4 })
        expect(onHasteOf('shenxing_baibian_buff', 1, c2)).toBeCloseTo(12)
    })

    it('战斗里真的挂上、并且按新刻度减免招式成本（凌波微步：身法20 + 急速16 = 36%）', () => {
        const me = makeChar('A', { agility: 20 }, [passive('ling_bo_wei_bu')])
        const engine = new BattleEngine(me, makeChar('B'), 4)
        const { engine: after } = runBattle(me, makeChar('B'), undefined, 4, true)
        const self = after.state.characters[0]
        void engine
        expect(after.state.pendingBuffs.has(`ling_bo_wei_bu_buff::${self.id}`)).toBe(true)
        expect(self.getHaste(after.state)).toBeCloseTo(16)
        const raw = self.attrs.get('agility') + self.getHaste(after.state)
        expect(calcApCostReduction(self.attrs.get('agility'), self.getHaste(after.state))).toBeCloseTo(Math.min(0.4, raw * 0.01))
        expect(calcActionCostAfterSpeed(4, self.attrs.get('agility'), self.getHaste(after.state))).toBeLessThan(4)
    })

    it('风切（武器）走 on_equip，开战即有急速', () => {
        const build: CharacterBuild = { ...makeChar('A').build, weapon: 'ninja_sword' }
        const me = new Character(build)
        const { engine } = runBattle(me, makeChar('B'), undefined, 4, true)
        const self = engine.state.characters[0]
        expect(engine.state.pendingBuffs.has(`ninja_sword_haste::${self.id}`)).toBe(true)
        expect(self.getHaste(engine.state)).toBeCloseTo(12)
    })
})

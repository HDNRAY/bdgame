import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { getBuff } from '../../data/buffs'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { AttrName } from '../entities/attributes'

/**
 * 不滞于物（`bu_zhi_yu_wu`）：附加 **力道 / 身法 / 灵巧 / 推演中最高者** × 0.05 的伤害，
 * **每次命中消耗 1 点缠劲**，缠劲不足则不附加。
 *
 * 回归点：原先固定吃推演（`wisdom × 0.05`）—— 对力道/灵巧流的持有者（杨之改、红提）几乎无效。
 */
const buff = getBuff('bu_zhi_yu_wu')!

function charWith(attrs: Partial<Record<AttrName, number>>, chan = 5): Character {
    const base: CharacterBuild = {
        id: 't',
        name: 't',
        story: 'balanced',
        // 桃木剑不带任何 attach buff（赤手空拳自带身法+2，会污染「最高者」的断言）
        weapon: 'peach_sword',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10, ...attrs },
        battleStyle: 'clinch',
        rewards: [],
    }
    const c = new Character(base)
    c.chan = chan // 附加伤害要花 1 缠，给测试角色留出缠劲
    return c
}

/** 打一击，返回「附加后的伤害」与「剩余缠劲」 */
const hit = (attrs: Partial<Record<AttrName, number>>, chan = 5, final = 0) => {
    const c = charWith(attrs, chan)
    const out = buff.onDealDamage!({
        final,
        raw: final,
        target: {} as never,
        attacker: c,
        state: {} as never,
        layer: { restoreValue: 1 },
    })
    return { out: out as number, chanLeft: c.chan }
}

const bonus = (attrs: Partial<Record<AttrName, number>>) => hit(attrs).out

describe('不滞于物', () => {
    it('力道最高 → 吃力道', () => {
        expect(bonus({ strength: 20 })).toBeCloseTo(1, 10) // 20 × 0.05
    })

    it('身法最高 → 吃身法', () => {
        expect(bonus({ agility: 24 })).toBeCloseTo(1.2, 10)
    })

    it('灵巧最高 → 吃灵巧', () => {
        expect(bonus({ dexterity: 30 })).toBeCloseTo(1.5, 10)
    })

    it('推演最高 → 吃推演（与旧行为一致）', () => {
        expect(bonus({ wisdom: 18 })).toBeCloseTo(0.9, 10)
    })

    it('是「最高者」而不是「四者之和」：其余三项不叠加', () => {
        expect(bonus({ strength: 20, agility: 20, dexterity: 20, wisdom: 20 })).toBeCloseTo(1, 10)
    })

    it('加在 final 之上', () => {
        expect(hit({ strength: 20 }, 5, 10).out).toBeCloseTo(11, 10)
    })

    it('每次附加消耗 1 点缠劲', () => {
        const r = hit({ strength: 20 })
        expect(r.out).toBeCloseTo(1, 10)
        expect(r.chanLeft).toBe(4)
    })

    it('缠劲为 0：不附加、也不扣成负数（返回原伤害）', () => {
        const r = hit({ strength: 20 }, 0, 7)
        expect(r.out).toBe(7)
        expect(r.chanLeft).toBe(0)
        expect(r.out).not.toBeCloseTo(8, 10)
    })
})

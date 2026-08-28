import { describe, it, expect } from 'vitest'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'
import { Character } from '../entities/character'
import type { ActionDefinition } from '../entities/action'
import type { BuffLayer } from '../combat/types'

/** 构造看破 buff 的 layer（含 kanpo_<tag> 计数） */
function layer(counts: Record<string, number>): BuffLayer {
    return { restoreValue: 1, extra: counts }
}

describe('dongyou_zhuwei 洞幽烛微', () => {
    const buff = getBuff('dongyou_zhuwei')!

    it('buff 定义存在且钩子齐全', () => {
        expect(buff).toBeDefined()
        expect(buff.onOpponentAction).toBeTypeOf('function')
        expect(buff.onDodgeChance).toBeTypeOf('function')
        expect(buff.onTakeDamage).toBeTypeOf('function')
    })

    it('onOpponentAction 按招式 tag 累计看破次数', () => {
        const l = layer({})
        const source = { tags: ['slash', 'burn'] }
        buff.onOpponentAction!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: l, source: source as never })
        buff.onOpponentAction!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: l, source: source as never })
        expect(l.extra?.['kanpo_slash']).toBe(2)
        expect(l.extra?.['kanpo_burn']).toBe(2)
    })

    it('看破率 = min(7%, 2%×log2(1+各tag次数之和))', () => {
        const rate1 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 1 }), source: { tags: ['slash'] } as never })
        expect(rate1).toBeCloseTo(0.02, 5)
        // 3 次 → 2×log2(4) = 4%
        const rate3 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 3 }), source: { tags: ['slash'] } as never })
        expect(rate3).toBeCloseTo(0.04, 5)
        // 7 次 → 2×log2(8) = 6%
        const rate7 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 7 }), source: { tags: ['slash'] } as never })
        expect(rate7).toBeCloseTo(0.06, 5)
        // 15 次 → 2×log2(16) = 8% → 截断到 7%
        const rate15 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 15 }), source: { tags: ['slash'] } as never })
        expect(rate15).toBe(0.07)
        // 100 次仍封顶 7%
        const rate100 = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 100 }), source: { tags: ['slash'] } as never })
        expect(rate100).toBe(0.07)
    })

    it('多 tag 招式取各 tag 次数之和', () => {
        // slash 1 + burn 1 → 共 2 次 → 2×log2(3) ≈ 3.17%
        const rate = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 1, kanpo_burn: 1 }), source: { tags: ['slash', 'burn'] } as never })
        expect(rate).toBeCloseTo(2 * Math.log2(3) / 100, 5)
    })

    it('未看破的 tag 不加成', () => {
        const rate = buff.onDodgeChance!({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 5 }), source: { tags: ['poison'] } as never })
        expect(rate).toBe(0)
    })

    it('减伤按看破率等比削减', () => {
        const final = buff.onTakeDamage!({ final: 100, raw: 100, target: {} as never, attacker: {} as never, state: {} as never, layer: layer({ kanpo_slash: 7 }), source: { tags: ['slash'] } as never })
        expect(final).toBe(94) // 100 × (1 - 0.06)
    })
})

describe('hui_lei_qian 虺雷牵', () => {
    const buff = getBuff('hui_lei_qian')!

    it('雷系招式命中+8%，非雷系不加成', () => {
        const ctx = (tags: string[]) =>
            ({ final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: { restoreValue: 1 }, source: { tags } as never })
        expect(buff.onHitChance!(ctx(['electric', 'qi']))).toBe(0.08)
        expect(buff.onHitChance!(ctx(['unarmed', 'melee']))).toBe(0)
        expect(buff.onHitChance!(ctx(['electric']))).toBe(0.08)
        expect(buff.onHitChance!(ctx([]))).toBe(0)
    })
})

describe('雷法灌注 → 虺雷牵联动', () => {
    it('雷法强化后的 unarmed 招式带 electric tag，虺雷牵对其生效', () => {
        const thunderArt = getPassive('thunder_art')!
        const huiLeiQian = getBuff('hui_lei_qian')!

        // 六阳掌是 unarmed damage 招式，被雷法强化后应带 electric tag
        const action: ActionDefinition = { id: 'liu_yang_zhang', name: '六阳掌', description: '', tags: ['unarmed', 'melee'], requiredTags: [], apCost: 2, effects: [{ type: 'damage', scaling: {} }] }
        const enhanced = thunderArt.actionEnhancer!(action)
        expect(enhanced.tags).toContain('electric')

        // 虺雷牵对强化后的招式返回 0.08
        const ctx = { final: 0, raw: 0, target: {} as never, attacker: {} as never, state: {} as never, layer: { restoreValue: 1 }, source: enhanced }
        expect(huiLeiQian.onHitChance!(ctx as never)).toBe(0.08)
    })

    it('非 unarmed 招式不被雷法强化', () => {
        const thunderArt = getPassive('thunder_art')!
        const action: ActionDefinition = { id: 'electric_yoyo', name: '电光火石', description: '', tags: ['electric', 'qi'], requiredTags: [], apCost: 2, effects: [{ type: 'damage', scaling: {} }] }
        expect(thunderArt.actionEnhancer!(action)).toBe(action) // 原样返回
    })
})

describe('baihu_ding 白虎定', () => {
    const buff = getBuff('baihu_ding')!

    it('闪避时回复2点缠劲', () => {
        // 构造一个 chan=0 的角色，闪避后 chan=2
        const char = new Character({
            id: 'B',
            name: '乙',
            weapon: 'po_lang_zhu_zhi',
            baseAttrs: { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 },
            rewards: [],
        })
        expect(char.chan).toBe(0)
        buff.onDodged!({
            final: 0,
            raw: 0,
            target: char,
            attacker: {} as never,
            state: { turn: { currentTime: 0 } } as never,
            layer: { restoreValue: 1 },
            engine: { checkChanOverflow: () => {}, emitLog: () => {} } as never,
        })
        expect(char.chan).toBe(2)
    })
})

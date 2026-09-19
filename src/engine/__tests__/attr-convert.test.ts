import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { convertAttrAmount, round1 } from '../util/math'
import { getBuff } from '../../data/buffs'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { AttrName } from '../entities/attributes'

/**
 * 构造期属性转化的取整口径**全局唯一**：`round(from × ratio)`。
 *
 * 回归点：类型上曾有 `mode?: 'round' | 'floor'`，两处显式 floor、两处漏写走默认 round ——
 * 同一机制两种表现。现在字段删掉、统一 round。
 * 归元劲·内耗（`inner_power_cost`）必须用同一口径，否则会「按一种取整收 AP、按另一种给属性」。
 */
const build = (base: Partial<Record<AttrName, number>>, rewards: string[]): CharacterBuild => ({
    id: 't',
    name: 't',
    story: 'balanced',
    weapon: 'bare_hands',
    baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10, ...base },
    battleStyle: 'clinch',
    rewards: rewards.map((id) => ({ id, name: id, type: 'passive' as const, description: '', tags: [] })),
})

describe('attrConvert 取整口径', () => {
    it('convertAttrAmount 恒为 round', () => {
        expect(convertAttrAmount(3, 0.3)).toBe(1) // 0.9 → 1
        expect(convertAttrAmount(4, 0.3)).toBe(1) // 1.2 → 1
        expect(convertAttrAmount(15, 0.1)).toBe(2) // 1.5 → 2（floor 只给 1）
        expect(convertAttrAmount(2, 0.25)).toBe(1) // 0.5 → 1
        expect(convertAttrAmount(1, 0.25)).toBe(0) // 0.25 → 0
    })

    it('玄女剑法：灵巧 4 给 1 点，灵巧 5 给 2 点（1.5 进位）', () => {
        // 与「不带该功法」的对照相减 —— 武器自带属性（bare_hands 身法+2 等）不参与断言
        const gain = (dex: number) => {
            const on = new Character(build({ dexterity: dex }, ['xuannv_sword']))
            const off = new Character(build({ dexterity: dex }, []))
            return on.attrs.get('strength') - off.attrs.get('strength')
        }
        // 属性下限会夹到 3，所以从 4 起测
        expect(gain(4)).toBe(1) // 1.2 → 1
        expect(gain(5)).toBe(2) // 1.5 → 2（floor 只给 1）
    })

    it('归元劲：推演 15 → 四维各 +2（round），且内耗按 +2 收', () => {
        const on = new Character(build({ wisdom: 15 }, ['inner_power']))
        const off = new Character(build({ wisdom: 15 }, []))
        for (const attr of ['strength', 'vitality', 'agility', 'dexterity'] as const) {
            expect(on.attrs.get(attr) - off.attrs.get(attr), attr).toBe(2) // round(15 × 0.1) = 2
        }
        const c = on
        // 内耗按「实际转化出多少点」收：round(15×0.1)=2 点 → -round1(2×0.15)
        const cost = getBuff('inner_power_cost')!.apRegenPerSec!({
            final: 0,
            raw: 0,
            target: c,
            attacker: c,
            state: {} as never,
            layer: { restoreValue: 1 },
        })
        expect(cost).toBeCloseTo(-round1(convertAttrAmount(15, 0.1) * 0.15), 10)
        expect(cost).toBeCloseTo(-0.3, 10)
    })

    it('数据里不再有 mode 字段（口径只由 convertAttrAmount 决定）', () => {
        for (const id of ['yu_yang_shi_ba_shi_convert', 'inner_power_convert', 'xuannv_sword_convert', 'qian_chui_bai_lian_convert']) {
            const cv = getBuff(id)!.attrConvert!
            expect(cv.length, id).toBeGreaterThan(0)
            for (const c of cv) expect(Object.keys(c).sort(), id).toEqual(['from', 'ratio', 'to'])
        }
    })
})

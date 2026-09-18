import { describe, it, expect } from 'vitest'
import { sumBuffAttrMods } from '../components/BattleStatusPanel/buff-attr-mods'
import type { BuffLayer } from '../../engine/combat/types'

/**
 * 战斗 HUD 属性分解的「状态」桶必须读**层上的真实 mods**。
 *
 * 回归点：以前用 `def.attrMods × 展示层数` 反推 —— 对动态属性 buff 一定错。
 * 最典型的是 秋水·盈虚（`autumn_water_tide`）：def 上写着 `attrMods: {dexterity: 4}`，
 * 但真实贡献是每 2 秒在灵巧/洞察之间挪 1 点的一张 `mods` 表；于是旧实现恒定显示「灵巧 +4」、
 * 从不显示洞察，分解加起来对不上画面上的真实属性。
 */

/** 只造这个函数需要的字段（`Pick<BattleSnapshot,'pendingBuffs'>`） */
const snap = (entries: Array<[string, BuffLayer]>) => ({ pendingBuffs: entries })

function layer(restoreValue: number, mods?: Record<string, number>): BuffLayer {
    return mods ? { restoreValue, mods } : { restoreValue }
}

describe('sumBuffAttrMods', () => {
    it('动态属性 buff：取层上的 mods，而不是 def.attrMods', () => {
        // 秋水 phase 3：def 说是 灵巧+4，实际是 灵巧+1 / 洞察+3
        const s = snap([['autumn_water_tide::otsu', layer(3, { dexterity: 1, insight: 3 })]])
        expect(sumBuffAttrMods('otsu', s)).toEqual({ dexterity: 1, insight: 3 })
    })

    it('phase 4（灵巧0/洞察4）不再谎报灵巧', () => {
        const s = snap([['autumn_water_tide::otsu', layer(4, { insight: 4 })]])
        expect(sumBuffAttrMods('otsu', s)).toEqual({ insight: 4 })
    })

    it('只算本角色，且把同名 buff 的双方分开', () => {
        const s = snap([
            ['autumn_water_tide::a', layer(1, { dexterity: 3, insight: 1 })],
            ['autumn_water_tide::b', layer(1, { dexterity: 3, insight: 1 })],
        ])
        expect(sumBuffAttrMods('a', s)).toEqual({ dexterity: 3, insight: 1 })
        expect(sumBuffAttrMods('b', s)).toEqual({ dexterity: 3, insight: 1 })
        expect(sumBuffAttrMods('c', s)).toEqual({})
    })

    it('独立叠层的 key（buffId::charId::appId）归到同一个角色并加算', () => {
        const s = snap([
            ['confuse::a::1', layer(1, { wisdom: -2 })],
            ['confuse::a::2', layer(1, { wisdom: -2 })],
            ['confuse::ab::1', layer(1, { wisdom: -99 })],
        ])
        expect(sumBuffAttrMods('a', s)).toEqual({ wisdom: -4 })
    })

    it('没有 mods 的层（纯钩子/标记层）不产生任何修正', () => {
        const s = snap([
            ['tianji_ready::a', layer(1)],
            ['stun_track::a', layer(0)],
        ])
        expect(sumBuffAttrMods('a', s)).toEqual({})
    })

    it('异常 key（没有 ::）被跳过，不炸也不误记', () => {
        const s = snap([['weird', layer(1, { strength: 9 })]])
        expect(sumBuffAttrMods('a', s)).toEqual({})
    })
})

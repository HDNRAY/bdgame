import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { applyBuffLayer, clearCcOnSuperArmor, partialRevertMods } from '../combat/utils/buff-apply'
import { processActionEffect } from '../combat/effects/action'
import { getBuff } from '../../data/buffs'
import type { BuffLayer } from '../combat/types'

/**
 * 「移除 buff 层」必须把这一层加过的属性一起退掉。
 *
 * 直接 `pendingBuffs.delete(key)` 会留下永久残影：净化解麻痹、霸体清眩晕、消耗型 buff 都踩过，
 * 表现是角色的身法/灵巧被悄悄吃掉且回不来（属于和「属性棘轮」同一族的口径 bug）。
 */
function makeChar(id: string, agility = 20, dexterity = 20): Character {
    return new Character({
        id,
        name: id,
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility, dexterity, insight: 10, wisdom: 10 },
        battleStyle: 'clinch',
        rewards: [],
    })
}

describe('移除 buff 层时属性要跟着退', () => {
    it('净化麻痹：身法/灵巧精确还原，且不动对手身上的层', () => {
        const me = makeChar('A')
        const enemy = makeChar('B')
        const engine = new BattleEngine(me, enemy, 4)
        const paralyze = getBuff('paralyze')!
        const agi0 = me.attrs.get('agility')
        const dex0 = me.attrs.get('dexterity')

        for (let i = 0; i < 3; i++) applyBuffLayer(engine, { buff: paralyze, target: me, stacks: 1, tMs: i + 1 })
        for (let i = 0; i < 2; i++) applyBuffLayer(engine, { buff: paralyze, target: enemy, stacks: 1, tMs: 100 + i })
        expect(me.attrs.get('agility')).toBe(agi0 - 3)
        expect(me.attrs.get('dexterity')).toBe(dex0 - 3)

        processActionEffect(
            { type: 'cleanse', buffIds: ['paralyze'] },
            { self: me, enemy, engine, tMs: 500 },
        )
        // 自己清干净、属性回到原值
        expect(me.attrs.get('agility')).toBe(agi0)
        expect(me.attrs.get('dexterity')).toBe(dex0)
        const paralyzeOf = (who: Character) =>
            [...engine.state.pendingBuffs.keys()].filter((k) => k.startsWith('paralyze::') && k.split('::')[1] === who.id)
        expect(paralyzeOf(me)).toHaveLength(0)
        // 对手的层不受影响（净化是 target: self，不能顺手把对手的毒/麻痹也清了）
        expect(paralyzeOf(enemy)).toHaveLength(2)
        expect(enemy.attrs.get('agility')).toBe(makeChar('B').attrs.get('agility') - 2)
    })

    it('霸体清硬控：independent 叠的眩晕也能清掉，并且属性退回去', () => {
        const me = makeChar('A')
        const engine = new BattleEngine(me, makeChar('B'), 4)
        const enemy = engine.state.characters[1]
        const agi0 = me.attrs.get('agility')
        // 眩晕的属性削减写在 afterApplyDebuff 里，要走 add_debuff 这条真实路径
        for (let i = 0; i < 2; i++) {
            processActionEffect(
                { type: 'add_debuff', buffId: 'stun', stacks: 1, chance: 1 },
                { self: enemy, enemy: me, engine, tMs: i + 1 },
            )
        }
        const stunned = me.attrs.get('agility')
        expect(stunned).toBeLessThan(agi0)

        clearCcOnSuperArmor(engine, me.id)
        expect(me.attrs.get('agility')).toBe(agi0)
        expect(me.attrs.get('insight')).toBe(10)
        expect([...engine.state.pendingBuffs.keys()].filter((k) => k.startsWith('stun::'))).toHaveLength(0)
    })

    it('部分退层被属性地板夹住时：按「实际退掉多少」记账', () => {
        const me = makeChar('A')
        // 手搓一层：账上 +2 身法
        const layer: BuffLayer = { restoreValue: 2, mods: { agility: 2 } }
        me.attrs.modify('agility', -100) // 压到地板 3，此时「退 1 点」根本退不动
        expect(me.attrs.get('agility')).toBe(3)

        partialRevertMods(layer, 1, me)
        expect(me.attrs.get('agility')).toBe(3)
        // 没退掉的仍然记在账上（旧实现会写成一，凭空少记一点）
        expect(layer.mods!.agility).toBe(2)
        expect(layer.restoreValue).toBe(1)
    })
})

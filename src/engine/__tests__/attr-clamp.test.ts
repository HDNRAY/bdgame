import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { applyAttrMods, revertBuffMods } from '../combat/utils/buff-layer'
import { processActionEffect } from '../combat/effects/action'
import { processBuffEnd } from '../combat/effects/buff-end'
import { ATTR_ABSOLUTE_MAX, ATTR_ABSOLUTE_MIN } from '../entities/attributes'

/**
 * 「属性写入时夹取 + 按实际生效量记账」这一族的一致性。
 *
 * 原来 `AttributeSet.get()` 是读时地板，`applyAttrMods` 又按 `get()` 的前后差记账 ——
 * 被地板/上限截掉的部分不记账，回滚时自然还不回来，属性会被**永久**吃掉（棘轮）。
 * 这里钉住：写入即夹取 → 记账精确 → 回滚精确。
 */
function makeChar(id: string, attrs: Partial<Record<string, number>> = {}): Character {
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
        } as Character['build']['baseAttrs'],
        battleStyle: 'clinch',
        rewards: [],
    })
}

describe('属性夹取与回滚', () => {
    it('增益撞上限后回滚，回到原值（不是回滚成「上限 − 原值」）', () => {
        const c = makeChar('A', { strength: 20 })
        const engine = new BattleEngine(c, makeChar('B'), 4)
        expect(c.attrs.get('strength')).toBe(20)

        const mods = applyAttrMods(c, engine.state, { strength: 20 }, '测试') // 想加到 40，被 30 夹住
        expect(c.attrs.get('strength')).toBe(ATTR_ABSOLUTE_MAX)
        expect(mods.strength).toBe(10) // 实际只生效了 +10

        revertBuffMods({ restoreValue: 0, mods }, c, engine.state)
        expect(c.attrs.get('strength')).toBe(20)
    })

    it('减益撞下限后回滚，回到原值', () => {
        const c = makeChar('A', { agility: 6 })
        const engine = new BattleEngine(c, makeChar('B'), 4)
        const start = c.attrs.get('agility') // 赤手空拳自带 +2 身法，不写死
        const mods = applyAttrMods(c, engine.state, { agility: -20 }, '测试')
        expect(c.attrs.get('agility')).toBe(ATTR_ABSOLUTE_MIN)
        expect(mods.agility).toBe(ATTR_ABSOLUTE_MIN - start)
        revertBuffMods({ restoreValue: 0, mods }, c, engine.state)
        expect(c.attrs.get('agility')).toBe(start)
    })

    it('超越（属性倍增）：撞上限也按实际生效量回滚，且不再假设倍率是 2', () => {
        const c = makeChar('A', { strength: 20 })
        const enemy = makeChar('B')
        const engine = new BattleEngine(c, enemy, 4)

        processActionEffect(
            { type: 'stat_multiply', stat: 'strength', multiplier: 2 },
            { self: c, enemy, engine, tMs: 0 },
        )
        expect(c.attrs.get('strength')).toBe(ATTR_ABSOLUTE_MAX)
        const key = [...engine.state.pendingBuffs.keys()].find((k) => k.startsWith('stat_multiply::'))!
        processBuffEnd(key, engine)
        expect(c.attrs.get('strength')).toBe(20)

        // 非整数倍率（内容里暂时没有，但机制不许依赖「倍率=2」）
        const d = makeChar('C', { strength: 10 })
        const engine2 = new BattleEngine(d, makeChar('D'), 4)
        processActionEffect(
            { type: 'stat_multiply', stat: 'strength', multiplier: 1.5 },
            { self: d, enemy: engine2.state.characters[1], engine: engine2, tMs: 0 },
        )
        expect(d.attrs.get('strength')).toBe(15)
        const key2 = [...engine2.state.pendingBuffs.keys()].find((k) => k.startsWith('stat_multiply::'))!
        processBuffEnd(key2, engine2)
        expect(d.attrs.get('strength')).toBe(10)
    })
})

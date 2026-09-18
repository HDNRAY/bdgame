import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { applyAttrMods, setLayerMods } from '../combat/utils/buff-layer'
import { removeBuffLayer } from '../combat/utils'
import { getBuff } from '../../data/buffs'
import { applyBuffLayer } from '../combat/utils/buff-apply'
import { processActionEffect } from '../combat/effects/action'
import { processBuffEnd } from '../combat/effects/buff-end'
import { ATTR_ABSOLUTE_MAX, ATTR_ABSOLUTE_MIN } from '../entities/attributes'

/**
 * 「属性写入即夹取 + 层里存请求值 + 重算按序回放」这一族的一致性。
 *
 * 旧实现按「实际生效量」记账（读时地板 + 前后差），夹掉的部分不记账、回滚时还不回来，
 * 属性会被永久吃掉（棘轮）。现在层里存的是**请求值**，属性一律由重算得出：
 * 夹取只影响当前读数，不影响账；删条目重算必然回到正确值。
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

describe('属性夹取与回放', () => {
    it('增益撞上限：请求值照记，实际生效量只用于展示', () => {
        const c = makeChar('A', { strength: 20 })
        const engine = new BattleEngine(c, makeChar('B'), 4)
        expect(c.attrs.get('strength')).toBe(20)

        const { requested, applied } = applyAttrMods(c, engine.state, { strength: 20 }, '测试') // 想加到 40
        expect(c.attrs.get('strength')).toBe(ATTR_ABSOLUTE_MAX)
        expect(requested.strength).toBe(20) // 账上是请求值
        expect(applied.strength).toBe(10) // 实际只生效 +10

        // 把请求值写进一层再删掉：重算回原值
        engine.state.pendingBuffs.set('probe::A', { restoreValue: 1, mods: { ...requested } })
        c.rebuildDerived(engine.state)
        expect(c.attrs.get('strength')).toBe(ATTR_ABSOLUTE_MAX)
        removeBuffLayer(engine, 'probe::A')
        expect(c.attrs.get('strength')).toBe(20)
    })

    it('减益撞下限：删条目后精确回到原值', () => {
        const c = makeChar('A', { agility: 6 })
        const engine = new BattleEngine(c, makeChar('B'), 4)
        const start = c.attrs.get('agility') // 赤手空拳自带 +2 身法，不写死
        const { requested } = applyAttrMods(c, engine.state, { agility: -20 }, '测试')
        expect(c.attrs.get('agility')).toBe(ATTR_ABSOLUTE_MIN)
        engine.state.pendingBuffs.set('probe::A', { restoreValue: 1, mods: { ...requested } })
        c.rebuildDerived(engine.state)
        expect(c.attrs.get('agility')).toBe(ATTR_ABSOLUTE_MIN)
        removeBuffLayer(engine, 'probe::A')
        expect(c.attrs.get('agility')).toBe(start)
    })

    it('超越（属性倍增）：按倍率回放，到期回原值，且不假设倍率是 2', () => {
        const c = makeChar('A', { strength: 20 })
        const enemy = makeChar('B')
        const engine = new BattleEngine(c, enemy, 4)

        processActionEffect(
            { type: 'stat_multiply', stat: 'strength', multiplier: 2 },
            { self: c, enemy, engine, tMs: 0 },
        )
        expect(c.attrs.get('strength')).toBe(ATTR_ABSOLUTE_MAX)
        // 中途来一次重算：倍率条目复现，读数不变
        c.rebuildDerived(engine.state)
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

    it('数据层动态属性修正：setLayerMods 直接换请求值，重算得出结果', () => {
        const c = makeChar('A')
        const engine = new BattleEngine(c, makeChar('B'), 4)
        const buff = getBuff('paralyze')!
        applyBuffLayer(engine, { buff, target: c, stacks: 1, tMs: 1 })
        // 注意：开局还会物化出附着 buff 的层（attrsInLedger，不参与属性），要按前缀挑目标层
        const key = [...engine.state.pendingBuffs.keys()].find((k) => k.startsWith('paralyze::'))!
        const layer = engine.state.pendingBuffs.get(key)!
        const naked = makeChar('A').attrs.get('agility') // 赤手空拳自带 +2 身法
        setLayerMods(layer, c, engine.state, { agility: -4 })
        expect(c.attrs.get('agility')).toBe(naked - 4)
        setLayerMods(layer, c, engine.state, {})
        expect(c.attrs.get('agility')).toBe(naked)
    })
})

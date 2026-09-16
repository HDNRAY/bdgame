import { describe, it, expect } from 'vitest'
import { TRIGGER_CONDITIONS, SELECTABLE_TRIGGER_CONDITIONS } from '../triggers'
import { getTriggerConditionName } from '../../bridge/triggerDisplay'

/**
 * 触发条件表的两条不变量（进玩家下拉的那些必须满足）：
 * 1. 有中文名 —— 下拉项不能显示成裸标识符（`getTriggerConditionName` 查不到名就回退成 type）
 * 2. 名字互不重复 —— 两个同名的选项玩家分不出来
 * 内部种类（`internal: true`）不过这两条，但也不该出现在玩家的下拉里。
 */
describe('触发条件表', () => {
    it('id 唯一', () => {
        const ids = TRIGGER_CONDITIONS.map((t) => t.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('玩家可选的每一条都有中文名（不许出现裸 id）', () => {
        const bad = SELECTABLE_TRIGGER_CONDITIONS.filter((t) => getTriggerConditionName(t.id) === t.id).map((t) => t.id)
        expect(bad).toEqual([])
    })

    it('玩家可选的显示名互不重复', () => {
        const seen = new Map<string, string[]>()
        for (const t of SELECTABLE_TRIGGER_CONDITIONS) {
            const name = getTriggerConditionName(t.id)
            seen.set(name, [...(seen.get(name) ?? []), t.id])
        }
        const dup = [...seen.entries()].filter(([, ids]) => ids.length > 1)
        expect(dup).toEqual([])
    })

    it('下拉里不含任何内部种类', () => {
        expect(SELECTABLE_TRIGGER_CONDITIONS.some((t) => t.internal)).toBe(false)
    })

    it('内部种类仍留在总表里（数据/引擎按 id 引用时还能解析）', () => {
        const internalIds = TRIGGER_CONDITIONS.filter((t) => t.internal).map((t) => t.id)
        expect(internalIds).toContain('hp_below_30')
        expect(internalIds).toContain('hp_below_50')
        expect(internalIds).toContain('on_took_damage')
        expect(internalIds).toEqual(['hp_below_30', 'hp_below_50', 'on_took_damage'])
    })
})

import { describe, it, expect } from 'vitest'
import { TRIGGER_CONDITIONS, SELECTABLE_TRIGGER_CONDITIONS } from '../triggers'
import { getTriggerConditionName } from '../../bridge/triggerDisplay'

/**
 * 触发条件表的三条不变量：
 * 1. 只收「交手事件」（见招拆招）——自身状态门槛（血量等）属于出招条件，不进本表
 * 2. 玩家可选的每条都有中文名 —— 下拉项不能显示成裸标识符
 *    （`getTriggerConditionName` 查不到名就回退成 type）
 * 3. 玩家可选的显示名互不重复 —— 两个同名的选项玩家分不出来
 * 内部种类（`internal: true`）不过 2/3，但也不该出现在玩家的下拉里。
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
        expect(TRIGGER_CONDITIONS.filter((t) => t.internal).map((t) => t.id)).toEqual(['on_took_damage'])
    })

    it('不收自身状态门槛：表里没有 hp_below 之类的自查条件', () => {
        // 血量阈值属于「出招条件」，不是交手事件
        expect(TRIGGER_CONDITIONS.some((t) => t.type === 'hp_below')).toBe(false)
    })

    it('不收过于宽泛的事件：on_attack 等于每次攻击都触发，且无数据使用', () => {
        expect(TRIGGER_CONDITIONS.some((t) => t.type === 'on_attack')).toBe(false)
    })
})

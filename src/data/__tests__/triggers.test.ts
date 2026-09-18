import { describe, it, expect } from 'vitest'
import { TRIGGER_CONDITIONS, SELECTABLE_TRIGGER_CONDITIONS } from '../triggers'
import { getTriggerConditionName } from '../../bridge/triggerDisplay'
import { OPPONENTS } from '../opponents'
import { PASSIVES } from '../passives'
import { ARTIFACTS } from '../artifacts'
import { WEAPON_DB } from '../weapons/weapons'
import { STARTING_WEAPONS } from '../weapons/starting-weapons'
import { getAction } from '../actions'
import { canBeTriggerAction } from '../../game/entities/action-config'
import { runtimeSlotsOf } from '../../engine/entities/trigger'

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
        expect(TRIGGER_CONDITIONS.filter((t) => t.internal).map((t) => t.id)).toEqual([
            'on_took_damage',
            'on_construct',
        ])
    })

    it('不收自身状态门槛：表里没有 hp_below 之类的自查条件', () => {
        // 血量阈值属于「出招条件」，不是交手事件
        expect(TRIGGER_CONDITIONS.some((t) => t.type === 'hp_below')).toBe(false)
    })

    it('不收过于宽泛的事件：on_attack 等于每次攻击都触发，且无数据使用', () => {
        expect(TRIGGER_CONDITIONS.some((t) => t.type === 'on_attack')).toBe(false)
    })

})

describe('触发绑定的合法性', () => {
    /** 数据里所有运行时触发绑定：对手的 actionConfigs + 功法/奇物/武器自带的运行时槽 */
    const bindings: { owner: string; actionId: string }[] = []
    for (const d of OPPONENTS) {
        for (const ac of d.actionConfigs ?? []) if (ac.triggerId) bindings.push({ owner: d.id, actionId: ac.actionId })
    }
    for (const e of [...PASSIVES, ...ARTIFACTS, ...WEAPON_DB, ...STARTING_WEAPONS]) {
        for (const slot of runtimeSlotsOf(e)) if (slot.actionId) bindings.push({ owner: e.id, actionId: slot.actionId })
    }

    it('引用的招式都存在', () => {
        const bad = bindings.filter((b) => !getAction(b.actionId)).map((b) => `${b.owner} → ${b.actionId}`)
        expect(bad).toEqual([])
    })

    it('都指向可作触发的招式（位移与内息消耗 > 2 的会被引擎静默跳过，等于白配一个槽）', () => {
        const bad: string[] = []
        for (const b of bindings) {
            const def = getAction(b.actionId)
            if (def && !canBeTriggerAction(def)) {
                bad.push(`${b.owner} → ${def.name}(apCost ${def.apCost}${def.tags.includes('move') ? ', move' : ''})`)
            }
        }
        expect(bad).toEqual([])
    })

    it('确实覆盖到了绑定（防止上面两条变成空跑）', () => {
        expect(bindings.length).toBeGreaterThan(20)
    })
})

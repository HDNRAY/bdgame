import { describe, it, expect } from 'vitest'
import { OPPONENTS, gen } from '../../data/opponents'
import { CONDITION_TYPES } from '../../data/conditions'
import { TRIGGER_CONDITIONS } from '../../data/triggers'

/**
 * 数据护栏：
 * 1. 出招条件只有一套表达 —— 结构化 `condition`；旧 `conditionId` 只允许出现在读旧存档的迁移路径里
 * 2. 触发槽绑定的 id 必须存在且不重复（重复会在 Character 构造时抛错）
 */
describe('对手招式配置', () => {
    it('不再使用旧 conditionId（条件一律结构化）', () => {
        const bad: string[] = []
        for (const def of OPPONENTS) {
            for (const ac of def.actionConfigs ?? []) {
                if (ac.conditionId) bad.push(`${def.id}: ${ac.actionId} → ${ac.conditionId}`)
            }
        }
        expect(bad).toEqual([])
    })

    it('结构化条件的类型都在 CONDITION_TYPES 里', () => {
        const known = new Set(CONDITION_TYPES.map((t) => t.type))
        const bad: string[] = []
        for (const def of OPPONENTS) {
            for (const ac of def.actionConfigs ?? []) {
                if (ac.condition && !known.has(ac.condition.type)) bad.push(`${def.id}: ${ac.actionId} → ${ac.condition.type}`)
            }
        }
        expect(bad).toEqual([])
    })

    it('triggerId 全部可解析且不重复', () => {
        const bad: string[] = []
        for (const def of OPPONENTS) {
            const seen = new Set<string>()
            for (const ac of def.actionConfigs ?? []) {
                if (!ac.triggerId) continue
                if (!TRIGGER_CONDITIONS.some((t) => t.id === ac.triggerId)) bad.push(`${def.id}: 未知触发 ${ac.triggerId}`)
                if (seen.has(ac.triggerId)) bad.push(`${def.id}: 重复触发 ${ac.triggerId}`)
                seen.add(ac.triggerId)
            }
        }
        expect(bad).toEqual([])
    })

    it('生成 33 级对手时条件配置不丢字段、也不回退成旧格式', () => {
        for (const def of OPPONENTS) {
            const build = gen(def, 33)
            for (const ac of build.actionConfigs ?? []) {
                expect(ac.conditionId, `${def.id}/${ac.actionId}`).toBeUndefined()
            }
        }
    })
})

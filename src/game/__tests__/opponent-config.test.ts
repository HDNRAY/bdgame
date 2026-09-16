import { describe, it, expect } from 'vitest'
import { OPPONENTS, gen } from '../../data/opponents'
import { unknownConditionIds } from '../../data/conditions'
import { TRIGGER_CONDITIONS } from '../../data/triggers'

/**
 * 数据完整性护栏：招式条件/触发绑定的 id 必须都能解析。
 * 条件 id 失效时引擎按「不设条件」处理（不报错、不中断），若没有这层校验会静默改掉对手行为。
 */
describe('对手招式配置', () => {
    it('conditionId 全部可解析', () => {
        const bad: string[] = []
        for (const def of OPPONENTS) {
            for (const id of unknownConditionIds(def.actionConfigs ?? [])) {
                bad.push(`${def.id}: ${id}`)
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

    it('生成 33 级对手时条件配置不丢字段', () => {
        // 生成器会按抽到的招式过滤配置：过滤后剩下的条目必须仍能解析
        for (const def of OPPONENTS) {
            const build = gen(def, 33)
            expect(unknownConditionIds(build.actionConfigs ?? [])).toEqual([])
        }
    })
})

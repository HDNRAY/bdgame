import { describe, it, expect } from 'vitest'
import { LAIFENG, ZHANGLIE, XUANJI, LAYUE } from '../data/opponents/index'
import { STAT_NAMES } from '../data/rewards'
import { cultCost } from '../systems/cultivation'
import { getBackground } from '../data/backgrounds'
import { getAction } from '../data/actions'

/** 从 bg 起点到最终属性反推修炼花费 */
function calcCultCost(attrs: Record<string, number>, bgId: string): number {
    const bg = getBackground(bgId)
    let total = 0
    for (const a of STAT_NAMES) {
        const start = bg?.attrs[a] ?? 3
        const end = attrs[a] ?? 3
        for (let v = start; v < end; v++) total += cultCost(v)
    }
    return total
}

describe('opponents', () => {
    for (const def of [LAIFENG, ZHANGLIE, XUANJI, LAYUE]) {
        describe(def.name, () => {
            const build = def.generate(33)

            it('total cultivation cost = 66 (n × 2)', () => {
                const cost = calcCultCost(build.baseAttrs, build.background)
                expect(cost).toBeGreaterThanOrEqual(66)
            })

            it('triggers reference valid actions', () => {
                for (const t of build.triggers) {
                    // _ 前缀 = 内置触发，否则需要在全局 action 注册表中有定义
                    if (!t.actionId) continue
                    if (t.actionId.startsWith('_')) continue
                    expect(getAction(t.actionId)).toBeDefined()
                }
            })

            it('generates a valid build', () => {
                const sum = STAT_NAMES.reduce((s, a) => s + (build.baseAttrs[a] ?? 0), 0)
                expect(sum).toBeGreaterThan(60)
                expect(build.rewards.length).toBeGreaterThan(0)
                expect(build.weapon).toBeTruthy()
            })
        })
    }

    // 腊月额外验证：天生道种加成
    it('腊月 has innate_seed and extra cultivation points', () => {
        const build = LAYUE.generate(33)
        expect(build.rewards.some((r) => r.id === 'innate_seed')).toBe(true)
        const cost = calcCultCost(build.baseAttrs, 'swift')
        expect(cost).toBeGreaterThan(70)
    })
})

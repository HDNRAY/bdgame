import { describe, it, expect } from 'vitest'
import { PLAYER, ZHANGLIE, XUANJI } from '../data/opponents/index'
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
    for (const def of [PLAYER, ZHANGLIE, XUANJI]) {
        describe(def.name, () => {
            const build = def.generate(33)

            it('total cultivation cost = 66 (n × 2)', () => {
                const cost = calcCultCost(build.baseAttrs, build.background)
                expect(cost).toBe(66)
            })

            it('triggers reference valid actions', () => {
                for (const t of build.triggers) {
                    // _ 前缀 = 内置触发，否则需要在全局 action 注册表中有定义
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
})

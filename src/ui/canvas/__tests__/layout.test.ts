import { describe, expect, it } from 'vitest'
import { MIN_CHAR_GAP_UNITS, enforceMinGap, facesRight, leftSideId } from '../layout'

/**
 * 贴身演出：两人逻辑位置很近（甚至相等）时，画面上不允许完全重合、且必须相对站立。
 *
 * 这些断言守的是用户口径：
 * - 「贴身时仍然相对站立」→ 左者朝右、右者朝左（与位置是否相等无关）。
 * - 「中间可以没有间距，但完全重合不行」→ 位置差不足最小间距时抬到最小间距，且仍 > 0。
 * - 「远端的档位不许弄坏」→ 位置差 ≥ 最小间距时原样返回（逐档一致）。
 */

/** 与 renderer 一致的取景：pxPerUnit = (画布宽 - 最大精灵宽) / viewUnits，viewUnits ≥ 8 */
function pxPerUnit(canvasWidth = 400, maxSpriteW = 60 * 3) {
    return (canvasWidth - maxSpriteW) / 8
}

describe('战斗画面布局 · 贴身最小间距', () => {
    it('位置完全相等（距离 0）→ 撑开到最小间距，两人不重合', () => {
        const [a, b] = enforceMinGap(0, 0)
        expect(a).not.toBe(b)
        expect(b - a).toBeCloseTo(MIN_CHAR_GAP_UNITS, 10)
        // 绕中点对称：左者仍在左
        expect(a).toBeCloseTo(-MIN_CHAR_GAP_UNITS / 2, 10)
        expect(b).toBeCloseTo(MIN_CHAR_GAP_UNITS / 2, 10)
    })

    it('实测最小的档位（距离 0.1，位置 -0.05 / +0.05）→ 画面上仍有最小间距', () => {
        const [a, b] = enforceMinGap(-0.05, 0.05)
        const screenGap = (b - a) * pxPerUnit()
        expect(b - a).toBeCloseTo(MIN_CHAR_GAP_UNITS, 10)
        // 画面上至少几十像素，肉眼能看出是两个人（不是 2.75px 那样的重合）
        expect(screenGap).toBeGreaterThan(30)
    })

    it('位置差 ≥ 最小间距 → 原样返回（远端逐档与改前一致）', () => {
        // 距离 2 / 4 / 4.9 三档的实测位置（见回报里的表）—— 这些档位一根头发都不许动
        const cases: Array<[number, number]> = [
            [-1, 1],
            [-2, 2],
            [0.27, 5.2],
            [-2, 2.96],
        ]
        for (const [a, b] of cases) {
            expect(enforceMinGap(a, b)).toEqual([a, b])
        }
    })

    it('实测距离 0.7 / 0.8 / 1.0 这几档也被抬到最小间距（它们同样近到会重合）', () => {
        for (const d of [0.74, 0.8, 1.0]) {
            const [a, b] = enforceMinGap(0, d)
            expect(b - a).toBeCloseTo(MIN_CHAR_GAP_UNITS, 10)
        }
    })

    it('实测「两人逻辑位置完全相同」（6 场真实对局里距离 0 的那种）到画面上有 41px 的位置差', () => {
        // 实测数据：距离 0 时双方 pos 都是 0.19
        const [a, b] = enforceMinGap(0.19, 0.19)
        const screenGap = (b - a) * pxPerUnit()
        expect(screenGap).toBeCloseTo(41.25, 6)
        expect(screenGap).toBeGreaterThan(0)
        // 且比改前（0px）明显不同
        expect(screenGap).not.toBeCloseTo(0, 1)
    })

    it('边界：位置差正好等于最小间距 → 不动', () => {
        const a = -MIN_CHAR_GAP_UNITS / 2
        const b = MIN_CHAR_GAP_UNITS / 2
        expect(enforceMinGap(a, b)).toEqual([a, b])
    })

    it('位置相等时也保持左右身份（A 在左、B 在右，不会互换）', () => {
        const [a, b] = enforceMinGap(0, 0)
        expect(a).toBeLessThan(b)
        // 两人一起偏移时仍绕其中点撑开
        const [c, d] = enforceMinGap(3, 3)
        expect(c + d).toBeCloseTo(6, 10)
        expect(c).toBeLessThan(d)
    })
})

describe('战斗画面布局 · 朝向按左右侧', () => {
    it('位置不同：左边那位朝右、右边那位朝左', () => {
        const chars = [
            { id: 'left', pos: -2 },
            { id: 'right', pos: 2 },
        ]
        const leftId = leftSideId(chars)
        expect(leftId).toBe('left')
        expect(facesRight('left', leftId)).toBe(true)
        expect(facesRight('right', leftId)).toBe(false)
    })

    it('位置相等（距离 0）：仍然一人朝右、一人朝左（不按 x 比较推）', () => {
        const chars = [
            { id: 'a', pos: 0 },
            { id: 'b', pos: 0 },
        ]
        const leftId = leftSideId(chars)
        const facing = chars.map((c) => facesRight(c.id, leftId))
        expect(facing).toEqual([true, false])
    })

    it('贴身（距离 0.1）：朝向与位置无关，仍是相对站立', () => {
        const chars = [
            { id: 'a', pos: -0.05 },
            { id: 'b', pos: 0.05 },
        ]
        const leftId = leftSideId(chars)
        expect(facesRight('a', leftId)).toBe(true)
        expect(facesRight('b', leftId)).toBe(false)
    })

    it('先出现的那位在位置相等时被当成左侧（结果稳定，不随帧抖动）', () => {
        expect(leftSideId([{ id: 'first', pos: 1 }, { id: 'second', pos: 1 }])).toBe('first')
        expect(leftSideId([{ id: 'first', pos: 1.2 }, { id: 'second', pos: 1.1 }])).toBe('second')
    })

    it('变异守卫：按 x 大小比较推朝向的旧写法（c.pos > otherPos）在位置相等时会让两人同朝向', () => {
        // 旧写法：renderer.ts 历史上是 `const facingRight = c.pos > otherPos`
        const oldWay = (pos: number, otherPos: number) => pos > otherPos
        const chars = [
            { id: 'a', pos: 0 },
            { id: 'b', pos: 0 },
        ]
        expect(oldWay(0, 0)).toBe(false)
        expect(oldWay(0, 0)).toBe(false)
        // 两人都判成「朝左」→ 就是用户报的「朝向一致」；新写法必须是一右一左
        const leftId = leftSideId(chars)
        expect([facesRight('a', leftId), facesRight('b', leftId)]).toEqual([true, false])
    })
})

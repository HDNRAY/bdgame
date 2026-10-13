import { describe, expect, it } from 'vitest'
import {
    MIN_CHAR_GAP_UNITS,
    SPRITE_CONTENT_OFFSET_COLS,
    bodyCenterX,
    contentCenterShiftX,
    enforceMinGap,
    facesRight,
    leftSideId,
} from '../layout'

/**
 * 贴身演出：两人逻辑位置很近（甚至相等）时，画面上不允许完全重合、且必须相对站立。
 *
 * 这些断言守的是用户口径：
 * - 「贴身时仍然相对站立」→ 左者朝右、右者朝左（与位置是否相等无关）。
 * - 「中间可以没有间距，但完全重合不行」→ 位置差不足最小间距时抬到最小间距，且仍 > 0。
 * - 「远端的档位不许弄坏」→ 位置差 ≥ 最小间距时原样返回（逐档一致）。
 *
 * 主判据是**身体间距**（不是画布中心距）：精灵美术在画布内偏右 13.5 列，必须按内容居中补偿，
 * 否则身体间距 = |centerGap − 81px| —— distance 4 会反叠、centerGap = 81px 时精确重合。
 */

const PIXEL = 3
const SPRITE_W = 60

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
        // 实测位置：距离 2.8 / 4.0 / 4.9（位置差 2.81 / 4.0 / 4.93，都 ≥ 2.5）—— 一根头发都不许动
        const cases: Array<[number, number]> = [
            [-0.81, 2.0],
            [-2, 2],
            [0.27, 5.2],
            [-2, 2.96],
        ]
        for (const [a, b] of cases) {
            expect(enforceMinGap(a, b)).toEqual([a, b])
        }
    })

    it('实测位置差 < 2.5 的档位（0.1/0.74/0.8/0.85/1.0/1.16/1.76/2.0）全部被抬到最小间距', () => {
        for (const d of [0.1, 0.74, 0.8, 0.85, 1.0, 1.16, 1.76, 2.0]) {
            const [a, b] = enforceMinGap(0, d)
            expect(b - a).toBeCloseTo(MIN_CHAR_GAP_UNITS, 10)
        }
    })

    it('实测位置差 ≥ 2.5 的档位（2.66 起）一格都不动', () => {
        for (const d of [2.66, 2.81, 3.85, 4.0, 4.93]) {
            const [a, b] = enforceMinGap(0, d)
            expect(b - a).toBeCloseTo(d, 10)
        }
    })

    it('单调性：改后的画面间距随逻辑距离单调不减（不会出现越近反而越开）', () => {
        // 实测各档位置差（升序）：0 / 0.1 / 0.74 / 0.8 / 0.85 / 1.0 / 1.16 / 1.76 / 2.0 / 2.66 / 2.81 / 3.85 / 4.0 / 4.93
        const diffs = [0, 0.1, 0.74, 0.8, 0.85, 1.0, 1.16, 1.76, 2.0, 2.66, 2.81, 3.85, 4.0, 4.93]
        const shown = diffs.map((d) => {
            const [a, b] = enforceMinGap(0, d)
            return b - a
        })
        for (let i = 1; i < shown.length; i++) {
            expect(shown[i]).toBeGreaterThanOrEqual(shown[i - 1] - 1e-9)
        }
        // 下一档 2.8 格（77.27px）必须仍大于最小值 68.75px —— 这是「单调性不破」的关键
        expect(2.81 * pxPerUnit()).toBeGreaterThan(MIN_CHAR_GAP_UNITS * pxPerUnit())
    })

    it('实测「两人逻辑位置完全相同」（6 场真实对局里距离 0 的那种）到画面上有 68.75px 的位置差', () => {
        // 实测数据：距离 0 时双方 pos 都是 0.19
        const [a, b] = enforceMinGap(0.19, 0.19)
        const screenGap = (b - a) * pxPerUnit()
        expect(screenGap).toBeCloseTo(68.75, 6)
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

/**
 * 主判据：**身体间距**（美术按内容居中之后 = 画面位置差）。
 * 「身体」= 精灵内容横向跨度，实测 15 列 = 45px。
 */
const BODY_W = 15 * PIXEL // 45px

/** 与 renderer 同源的画面位置差（clamp 之后） */
function screenGap(posA: number, posB: number, minGap = MIN_CHAR_GAP_UNITS): number {
    const [a, b] = enforceMinGap(posA, posB, minGap)
    return (b - a) * pxPerUnit()
}

/** 两个角色画布左上角 x（视图居中）→ 身体内容中心 x */
function bodyCenterOf(posA: number, posB: number, isA: boolean, centered: boolean, minGap = MIN_CHAR_GAP_UNITS) {
    const minP = Math.min(posA, posB)
    const maxP = Math.max(posA, posB)
    const ppu = pxPerUnit()
    const viewOffset = (minP + maxP) / 2
    const [a, b] = enforceMinGap(posA, posB, minGap)
    const pos = isA ? a : b
    const canvasLeft = 200 + (pos - viewOffset) * ppu - (SPRITE_W * PIXEL) / 2
    const facingRight = isA
    const col = facingRight ? 43 : SPRITE_W - 1 - 43
    void maxP
    // 改前：不做内容居中补偿；改后：补偿（== bodyCenterX）
    return centered
        ? bodyCenterX(canvasLeft, facingRight, SPRITE_W, PIXEL)
        : canvasLeft + (col + 0.5) * PIXEL
}

function bodyGap(posA: number, posB: number, centered: boolean, minGap = MIN_CHAR_GAP_UNITS): number {
    const ca = bodyCenterOf(posA, posB, true, centered, minGap)
    const cb = bodyCenterOf(posA, posB, false, centered, minGap)
    return Math.abs(cb - ca) - BODY_W // > 0 = 有缝；< 0 = 叠住
}

describe('战斗画面布局 · 身体间距（主判据）', () => {
    it('按内容居中补偿：身体中心落在画布中心（朝右/朝左都一样），偏移常量 = 13.5 列 = 40.5px', () => {
        expect(SPRITE_CONTENT_OFFSET_COLS).toBe(13.5)
        expect(contentCenterShiftX(true, PIXEL)).toBeCloseTo(-40.5, 10)
        expect(contentCenterShiftX(false, PIXEL)).toBeCloseTo(40.5, 10)
        // 画布中心 x = canvasLeft + 90；补偿后身体中心就是它
        for (const facingRight of [true, false]) {
            expect(bodyCenterX(50, facingRight, SPRITE_W, PIXEL)).toBeCloseTo(50 + (SPRITE_W * PIXEL) / 2, 10)
        }
    })

    it('变异守卫：不补偿内容偏心时，身体间距是 |centerGap − 81px|（距离 4 反叠、中心距 81px 时精确重合）', () => {
        // 「改前」= 既不按内容居中、也没有 clamp（minGap = 0）
        // 距离 4 → centerGap = 110px → 身体间距 = |110 − 81| − 45 = −16（叠住 16px）
        expect(bodyGap(-2, 2, false, 0)).toBeCloseTo(-16, 6)
        // 距离 2.95 → centerGap ≈ 81.1px → 改前几乎精确重合
        expect(bodyGap(-1.475, 1.475, false, 0)).toBeLessThan(-44)
        // 距离 2 → centerGap 55 → 改前 −19
        expect(bodyGap(-1, 1, false, 0)).toBeCloseTo(-19, 6)
        // 而改前距离 0 时身体其实还相距 81 − 45 = 36px（看着正常）—— 所以「完全重合」不在距离 0
        expect(bodyGap(0, 0, false, 0)).toBeCloseTo(36, 6)
    })

    it('补偿后：贴身档身体间距 = 68.75 − 45 = 23.75px（肉眼可见的空隙，不是 0）', () => {
        // 距离 0 / 0.1 / 1 / 2 全部被 clamp 到 2.5 格
        for (const d of [0, 0.1, 0.74, 1, 2]) {
            expect(bodyGap(-d / 2, d / 2, true)).toBeCloseTo(68.75 - BODY_W, 6)
            expect(bodyGap(-d / 2, d / 2, true)).toBeGreaterThan(20)
        }
    })

    it('补偿后全表单调：距离升序 → 身体间距不减，且无任何一档叠住（≥0）', () => {
        const diffs = [0, 0.1, 0.74, 0.8, 0.85, 1.0, 1.16, 1.76, 2.0, 2.66, 2.81, 3.85, 4.0, 4.93]
        const gaps = diffs.map((d) => bodyGap(-d / 2, d / 2, true))
        for (let i = 1; i < gaps.length; i++) {
            expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1] - 1e-9)
        }
        for (const g of gaps) expect(g).toBeGreaterThan(0)
        // 末端两档（距离 4 / 4.9）没被 clamp，与改前逐位一致
        expect(gaps[diffs.indexOf(4.0)]).toBeCloseTo(110 - BODY_W, 6)
        expect(gaps[diffs.indexOf(4.93)]).toBeCloseTo(4.93 * pxPerUnit() - BODY_W, 6)
    })

    it('距离 ≥ 2.5 格的档位：身体间距与改前（不 clamp）逐位一致', () => {
        for (const d of [2.66, 2.81, 3.85, 4.0, 4.93]) {
            // 改前改后的差别只在 clamp 与内容居中；这些档没被 clamp，
            // 而内容居中只把身体移到画布中心（两人同搬），间距不变
            const after = bodyGap(-d / 2, d / 2, true)
            const before = screenGap(-d / 2, d / 2) - BODY_W
            expect(after).toBeCloseTo(before, 6)
        }
    })
})

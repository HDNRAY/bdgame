import { describe, expect, it } from 'vitest'
import {
    BASE_FAMILY_UNIT,
    DESKTOP_MIN_FONT_PX,
    FONT_UNITS,
    SMALL_FAMILY_UNIT,
    applyFontUnits,
    classifyFontFamily,
    fontGridViolation,
    gridSteps,
    idealRootPx,
    isAllowedFontSize,
    isOnGrid,
    resolveFontUnits,
    snapToGrid,
} from '../boot/font-grid'

/** 允许集的生成规则（规则本身，不是枚举）：{ n×10 } ∪ { n×12 } */
function allowedSet(maxN: number): number[] {
    const out = new Set<number>()
    for (let n = 1; n <= maxN; n++) {
        out.add(n * 10)
        out.add(n * 12)
    }
    return [...out].sort((a, b) => a - b)
}

describe('允许集 { n×10 } ∪ { n×12 }', () => {
    it('规则生成：n=1..6 就是 10 12 20 24 30 36 40 48 50 60 72', () => {
        expect(allowedSet(6)).toEqual([10, 12, 20, 24, 30, 36, 40, 48, 50, 60, 72])
    })

    it('两族网格各自闭合：10 族只认 10 的倍数，12 族只认 12 的倍数', () => {
        expect(isOnGrid(10, SMALL_FAMILY_UNIT)).toBe(true)
        expect(isOnGrid(10, BASE_FAMILY_UNIT)).toBe(false)
        expect(isOnGrid(12, BASE_FAMILY_UNIT)).toBe(true)
        expect(isOnGrid(12, SMALL_FAMILY_UNIT)).toBe(false)
        expect(isOnGrid(30, SMALL_FAMILY_UNIT)).toBe(true)
        expect(isOnGrid(60, BASE_FAMILY_UNIT)).toBe(true)
        // 60 同时是 6×10 与 5×12：两族网格的交点
        expect(isOnGrid(60, SMALL_FAMILY_UNIT)).toBe(true)
    })

    it('边界：恰好 10 / 恰好 12 在集内；12 与 20 之间全不在；0 与负数不在', () => {
        expect(isAllowedFontSize(10)).toBe(true)
        expect(isAllowedFontSize(12)).toBe(true)
        expect(isAllowedFontSize(20)).toBe(true)
        for (const v of [13, 14, 15, 16, 17, 18, 19]) expect(isAllowedFontSize(v)).toBe(false)
        for (const v of [11, 0, -10, Number.NaN, Number.POSITIVE_INFINITY]) expect(isAllowedFontSize(v)).toBe(false)
    })

    it('边界：很大的值也在集内（网格无上限）', () => {
        expect(isAllowedFontSize(1440)).toBe(true)
        expect(isAllowedFontSize(1441)).toBe(false)
    })

    it('旧口径的实测值全部不在集内（这就是本次要修的）', () => {
        for (const v of [11.2, 13.44, 17.92, 26.88, 40.32]) expect(isAllowedFontSize(v)).toBe(false)
    })
})

describe('snapToGrid —— 就近取，正中间取小，下限 1 倍', () => {
    it('10 族：向上/向下就近，正中间（15）取小', () => {
        expect(snapToGrid(11.2, 10)).toBe(10)
        expect(snapToGrid(14.9, 10)).toBe(10)
        expect(snapToGrid(15, 10)).toBe(10) // 正中间 → 取小
        expect(snapToGrid(15.1, 10)).toBe(20)
        expect(snapToGrid(8.7, 10)).toBe(10)
        expect(snapToGrid(9.9, 10)).toBe(10)
        expect(snapToGrid(25.1, 10)).toBe(30)
        expect(snapToGrid(1000, 10)).toBe(1000)
    })

    it('12 族：向上/向下就近，正中间（18）取小', () => {
        expect(snapToGrid(13.44, 12)).toBe(12)
        expect(snapToGrid(17.9, 12)).toBe(12)
        expect(snapToGrid(18, 12)).toBe(12) // 正中间 → 取小
        expect(snapToGrid(18.1, 12)).toBe(24)
        expect(snapToGrid(10.44, 12)).toBe(12)
        expect(snapToGrid(40.32, 12)).toBe(36)
        expect(snapToGrid(67.2, 12)).toBe(72)
    })

    it('下限 1 倍：再小的理想值也落在 10 / 12，不出现 0 或负数', () => {
        expect(snapToGrid(0, 10)).toBe(10)
        expect(snapToGrid(-5, 10)).toBe(10)
        expect(snapToGrid(0, 12)).toBe(12)
        expect(snapToGrid(-5, 12)).toBe(12)
    })

    it('非法输入不炸：非有限值退回 1 倍', () => {
        expect(snapToGrid(Number.NaN, 10)).toBe(10)
        expect(snapToGrid(Number.POSITIVE_INFINITY, 12)).toBe(12)
    })

    it('吸附结果永远落在本族网格上（扫一遍密集区间）', () => {
        for (const unit of FONT_UNITS) {
            for (let ideal = -5; ideal <= 200; ideal += 0.1) {
                expect(isOnGrid(snapToGrid(ideal, unit), unit)).toBe(true)
            }
        }
    })
})

describe('idealRootPx —— 与 index.css 的 clamp(12px, 16px×scale + 0.15vw, 48px) 同源', () => {
    it('1280 / 390 / 320 的实测值', () => {
        expect(idealRootPx(1280, 1)).toBeCloseTo(17.92, 6)
        expect(idealRootPx(390, 1)).toBeCloseTo(16.585, 6)
        expect(idealRootPx(320, 1)).toBeCloseTo(16.48, 6)
    })

    it('上下限夹紧', () => {
        expect(idealRootPx(320, 0.5)).toBe(12) // 8.48 → clamp 12
        expect(idealRootPx(20000, 2)).toBe(48) // 62 → clamp 48
    })
})

describe('resolveFontUnits —— 一次吸附、两族都在网格上', () => {
    const VIEWPORTS = [320, 390, 768, 1280, 1440, 2560]
    const SCALES = [0.5, 0.75, 1, 1.5, 2]

    it('四个 --ui-scale 档 × 多个视口：两族都在各自网格上，且都是正整数倍', () => {
        for (const w of VIEWPORTS) {
            for (const s of SCALES) {
                const u = resolveFontUnits(w, s)
                expect(Number.isInteger(u.steps)).toBe(true)
                expect(u.steps).toBeGreaterThanOrEqual(1)
                expect(u.small).toBe(SMALL_FAMILY_UNIT * u.steps)
                expect(u.base).toBe(BASE_FAMILY_UNIT * u.steps)
                expect(isOnGrid(u.small, SMALL_FAMILY_UNIT)).toBe(true)
                expect(isOnGrid(u.base, BASE_FAMILY_UNIT)).toBe(true)
                // 全集口径也要成立（ui-geometry.mjs 的断言用的就是它）
                expect(isAllowedFontSize(u.small)).toBe(true)
                expect(isAllowedFontSize(u.base)).toBe(true)
                // 不变式：正文不小于徽章
                expect(u.base).toBeGreaterThanOrEqual(u.small)
            }
        }
    })

    it('映射表：旧计算值 → 吸附后的档（1280 / 390 / 320，ui-scale = 1）', () => {
        expect(resolveFontUnits(1280, 1)).toMatchObject({ small: 10, base: 12 }) // 11.2→10  13.44→12
        expect(resolveFontUnits(390, 1)).toMatchObject({ small: 10, base: 12 }) // 10.3656→10  12.4387→12
        expect(resolveFontUnits(320, 1)).toMatchObject({ small: 10, base: 12 })
    })

    it('四个档（0.75 / 1 / 1.5 / 2）在桌面与手机上都给出确定的整数倍', () => {
        expect(resolveFontUnits(1280, 0.75).steps).toBe(1)
        expect(resolveFontUnits(1280, 1).steps).toBe(1)
        expect(resolveFontUnits(1280, 1.5).steps).toBe(2)
        expect(resolveFontUnits(1280, 2).steps).toBe(2)
        expect(resolveFontUnits(390, 0.75).steps).toBe(1)
        expect(resolveFontUnits(390, 2).steps).toBe(2)
    })

    it('整数倍 k 让整条令牌链都在允许集里（10k 12k 24k 36k 60k）', () => {
        for (const [w, s] of [
            [1280, 1],
            [1280, 1.5],
            [390, 2],
            [320, 0.75],
        ] as const) {
            const { steps: k } = resolveFontUnits(w, s)
            for (const multiple of [1, 2, 3, 5]) {
                expect(isAllowedFontSize(BASE_FAMILY_UNIT * k * multiple)).toBe(true)
            }
            expect(isAllowedFontSize(SMALL_FAMILY_UNIT * k)).toBe(true)
        }
    })
})

describe('gridSteps —— 给手动缩放控件枚举档位', () => {
    it('12 族 [12,36] → 12 / 24 / 36；10 族 [12,36] → 20 / 30（10、40 越界）', () => {
        expect(gridSteps(12, 12, 36)).toEqual([12, 24, 36])
        expect(gridSteps(10, 12, 36)).toEqual([20, 30])
    })

    it('只有一格 / 空集', () => {
        expect(gridSteps(12, 12, 12)).toEqual([12])
        expect(gridSteps(10, 1, 9)).toEqual([])
    })
})

describe('桌面口径：最小 12px + 族与字号匹配（fontGridViolation）', () => {
    const FAMILY_SMALL = '"Fusion Pixel 10px", "Fusion Fallback 10", system-ui, sans-serif'
    const FAMILY_BASE = '"Fusion Pixel 12px", "Fusion Fallback 12", system-ui, sans-serif'

    it('字族识别只看第一项', () => {
        expect(classifyFontFamily(FAMILY_SMALL)).toBe('small')
        expect(classifyFontFamily(FAMILY_BASE)).toBe('base')
        expect(classifyFontFamily('ui-monospace, Consolas, monospace')).toBe('other')
        expect(classifyFontFamily('')).toBe('other')
    })

    it('移动端：10 族 10px 合规、12 族 12px 合规', () => {
        expect(fontGridViolation(10, FAMILY_SMALL, false)).toBeNull()
        expect(fontGridViolation(12, FAMILY_BASE, false)).toBeNull()
        expect(fontGridViolation(20, FAMILY_SMALL, false)).toBeNull()
        expect(fontGridViolation(24, FAMILY_BASE, false)).toBeNull()
    })

    it('桌面端：10px 违规（桌面小于 12），12px 合规', () => {
        expect(fontGridViolation(10, FAMILY_SMALL, true)).toBe('桌面小于 12')
        expect(fontGridViolation(10, FAMILY_BASE, true)).toBe('桌面小于 12')
        expect(fontGridViolation(12, FAMILY_BASE, true)).toBeNull()
        expect(fontGridViolation(20, FAMILY_SMALL, true)).toBeNull()
        expect(DESKTOP_MIN_FONT_PX).toBe(12)
    })

    it('族与字号不配：10 族 12px / 12 族 10px 都违规（"拿 10 族渲染 1.2×"就是这一类）', () => {
        expect(fontGridViolation(12, FAMILY_SMALL, false)).toBe('10 族字号不在 10n')
        expect(fontGridViolation(10, FAMILY_BASE, false)).toBe('12 族字号不在 12n')
        expect(fontGridViolation(11.2, FAMILY_SMALL, false)).toBe('不在允许集')
    })

    it('不在允许集优先于族不匹配（13.44 既不在集里、也不是 10n）', () => {
        expect(fontGridViolation(13.44, FAMILY_SMALL, false)).toBe('不在允许集')
    })

    it('系统/回退字体只受"允许集 + 桌面下限"约束，不做族匹配', () => {
        expect(fontGridViolation(13.333, 'Arial, sans-serif', false)).toBe('不在允许集')
        expect(fontGridViolation(16, 'Arial, sans-serif', false)).toBe('不在允许集')
        expect(fontGridViolation(12, 'Arial, sans-serif', false)).toBeNull()
        expect(fontGridViolation(10, 'Arial, sans-serif', false)).toBeNull()
        expect(fontGridViolation(10, 'Arial, sans-serif', true)).toBe('桌面小于 12')
    })

    it('旧口径的实测值全部违规（9.36 / 11.2 / 13.44 / 17.92 / 26.88 / 40.32）', () => {
        for (const bad of [9.36, 11.2, 13.44, 17.92, 26.88, 40.32]) {
            expect(fontGridViolation(bad, FAMILY_BASE, false)).not.toBeNull()
        }
    })
})

describe('applyFontUnits —— 写进 <html> 内联样式的那两个变量', () => {
    function fakeDoc(width: number): Document {
        const props = new Map<string, string>()
        const style = {
            setProperty: (k: string, v: string) => {
                props.set(k, v)
            },
        }
        const documentElement = { style } as unknown as HTMLElement
        return {
            defaultView: { innerWidth: width },
            documentElement,
            __props: props,
        } as unknown as Document & { __props: Map<string, string> }
    }

    it('把两族当前档写成 px（-1.5 那档也要吸附）', () => {
        const doc = fakeDoc(1280)
        const u = applyFontUnits(doc, 1.5)
        const props = (doc as Document & { __props: Map<string, string> }).__props
        expect(u).toMatchObject({ small: 20, base: 24 })
        expect(props.get('--font-unit-10')).toBe('20px')
        expect(props.get('--font-unit-12')).toBe('24px')
        expect(isAllowedFontSize(Number.parseFloat(props.get('--font-unit-12')!))).toBe(true)
    })
})

import { describe, it, expect } from 'vitest'
import { rowIndexAtY } from '../components/CharacterPanel/rowDrag'

/** 5 行，行高 24，首行 bottom = 44（含表头占位） */
const bottoms = [44, 68, 92, 116, 140]

describe('拖拽落点计算 rowIndexAtY', () => {
    it('落在第 1 行内 → 0', () => {
        expect(rowIndexAtY(bottoms, 20)).toBe(0)
        expect(rowIndexAtY(bottoms, 43)).toBe(0)
    })

    it('落在行边界上 → 算下一行（y < bottom 判定）', () => {
        expect(rowIndexAtY(bottoms, 44)).toBe(1)
    })

    it('落在中间各行', () => {
        expect(rowIndexAtY(bottoms, 50)).toBe(1)
        expect(rowIndexAtY(bottoms, 100)).toBe(3)
        expect(rowIndexAtY(bottoms, 139)).toBe(4)
    })

    it('拖到最下方 → 最后一行', () => {
        expect(rowIndexAtY(bottoms, 200)).toBe(4)
        expect(rowIndexAtY(bottoms, 9999)).toBe(4)
    })

    it('没有行时返回 -1', () => {
        expect(rowIndexAtY([], 10)).toBe(-1)
    })
})

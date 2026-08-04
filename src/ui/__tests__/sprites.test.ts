import { describe, it, expect } from 'vitest'
import { SPRITES, DEFAULT_IDLE } from '../pixel-sprites/sprites'

describe('sprite PixelMap 完整性', () => {
    it('每个 PixelMap 的所有行长度一致（无错位行）', () => {
        const maps = [DEFAULT_IDLE]
        for (const set of Object.values(SPRITES)) {
            maps.push(set.idle)
            maps.push(set.attack)
        }
        for (const map of maps) {
            expect(map.length).toBeGreaterThan(0)
            const w = map[0].length
            expect(w).toBeGreaterThan(0)
            map.forEach((row, y) => {
                expect(row.length, `行 ${y} 宽度 ${row.length} ≠ 首行 ${w}`).toBe(w)
            })
        }
    })

    it('每个像素索引都在调色板覆盖范围内（0=透明，其余为正整数）', () => {
        const maps = [DEFAULT_IDLE]
        for (const set of Object.values(SPRITES)) {
            maps.push(set.idle)
            maps.push(set.attack)
        }
        for (const map of maps) {
            map.forEach((row, y) => {
                row.forEach((v, x) => {
                    expect(Number.isInteger(v), `(${x},${y}) 非整数`).toBe(true)
                    expect(v, `(${x},${y}) 为负数`).toBeGreaterThanOrEqual(0)
                })
            })
        }
    })
})

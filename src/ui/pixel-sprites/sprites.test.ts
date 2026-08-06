import { describe, expect, it } from 'vitest'
import { DEFAULT_IDLE, SPRITES } from './sprites'

describe('DEFAULT_IDLE', () => {
    it('是 48×48 网格', () => {
        expect(DEFAULT_IDLE).toHaveLength(48)
        for (const row of DEFAULT_IDLE) {
            expect(row).toHaveLength(48)
        }
    })

    it('非透明像素占比合理（有内容但非全满）', () => {
        let nonZero = 0
        for (const row of DEFAULT_IDLE) {
            for (const idx of row) {
                if (idx !== 0) nonZero++
            }
        }
        expect(nonZero).toBeGreaterThan(100)
        expect(nonZero).toBeLessThan(48 * 48)
    })
})

describe('SPRITES', () => {
    it('default 有 idle 和 attack 帧', () => {
        // padSprite 返回补齐后的新数组（非 DEFAULT_IDLE 引用），校验帧有效即可
        for (const frame of [SPRITES.default.idle, SPRITES.default.attack]) {
            expect(Array.isArray(frame)).toBe(true)
            expect(frame.length).toBeGreaterThan(0)
            expect(frame[0].length).toBeGreaterThan(0)
        }
    })
})

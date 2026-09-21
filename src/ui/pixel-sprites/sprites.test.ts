import { describe, expect, it } from 'vitest'
import { DEFAULT_IDLE, SPRITES } from './sprites'
import { HAND_COVER, HAND_POINTS, LEFT_HAND_COVER, OTHER_HAND_POINT, POSE_NAMES } from './weapons'

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

describe('姿势完整性', () => {
    // 结构性检查（不判断画得好不好）：新增姿势时最容易漏的是「画了帧没登记手部锚点」或反之。
    // 锚点缺一个，武器会叠到错误位置且不报错 —— 所以在这里挡。
    const handCoverPoses = POSE_NAMES.filter((p) => p !== 'hit') // hit 时武器脱手，不画手部盖片

    it('每个 POSE_NAMES 都有身体帧', () => {
        for (const pose of POSE_NAMES) {
            expect(SPRITES.default[pose], `缺少身体帧: ${pose}`).toBeDefined()
            expect(SPRITES.default[pose].length, `帧高异常: ${pose}`).toBe(SPRITES.default.idle.length)
        }
    })

    it('每个 POSE_NAMES 都有主手/副手握点', () => {
        for (const pose of POSE_NAMES) {
            expect(HAND_POINTS[pose], `缺少主手握点: ${pose}`).toBeDefined()
            expect(OTHER_HAND_POINT[pose], `缺少副手握点: ${pose}`).toBeDefined()
        }
    })

    it('非 hit 姿势都有手部遮罩（遮罩像素落在帧内）', () => {
        const frame = SPRITES.default.idle
        for (const pose of handCoverPoses) {
            for (const [name, table] of [
                ['HAND_COVER', HAND_COVER],
                ['LEFT_HAND_COVER', LEFT_HAND_COVER],
            ] as const) {
                const cover = table[pose]
                expect(cover, `${name} 缺少 ${pose}`).toBeDefined()
                expect(cover.length, `${name}.${pose} 为空`).toBeGreaterThan(0)
                for (const [x, y] of cover) {
                    expect(frame[y]?.[x], `${name}.${pose} 越界/指向空像素: (${x},${y})`).toBeDefined()
                }
            }
        }
    })

})

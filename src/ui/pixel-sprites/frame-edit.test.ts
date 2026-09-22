import { removePaletteColor } from './frame-edit'
import { describe, expect, it } from 'vitest'
import {
    SPRITE_AURA_SLOT,
    SPRITE_OUTLINE_SLOT,
    addAuraRing,
    autoOutline,
    fillAll,
    fillRegion,
    frameSize,
    frameStats,
    getCell,
    hitAnchor,
    isBodySlot,
    moveAnchor,
    snapAnchorToSkin,
    lineCells,
    paintCell,
    paintLine,
    shiftFrame,
} from './frame-edit'
import { blankPixelMap, formatAnchorSnippet } from './frame-io'
import { DEFAULT_BUFF, DEFAULT_IDLE } from './sprites'
import type { HandAnchorData } from './frame-edit'

describe('帧编辑操作', () => {
    it('paintCell 不改原帧，越界格被忽略', () => {
        const m = blankPixelMap(4, 4)
        const out = paintCell(m, 1, 1, 5)
        expect(getCell(out, 1, 1)).toBe(5)
        expect(getCell(m, 1, 1)).toBe(0)
        expect(getCell(paintCell(m, -1, 0, 5), 0, 0)).toBe(0)
        expect(getCell(paintCell(m, 4, 0, 5), 0, 0)).toBe(0)
    })

    it('paintCell 的镜像以帧中线为轴（宽 4 时 1 ↔ 2）', () => {
        const out = paintCell(blankPixelMap(4, 2), 1, 0, 3, { mirror: true })
        expect(getCell(out, 1, 0)).toBe(3)
        expect(getCell(out, 2, 0)).toBe(3)
        // 宽 5（奇数）时中列镜像到自己
        const odd = paintCell(blankPixelMap(5, 2), 2, 0, 3, { mirror: true })
        expect(getCell(odd, 2, 0)).toBe(3)
        expect(getCell(odd, 1, 0)).toBe(0)
    })

    it('lineCells 覆盖端点且不漏格（水平/垂直/斜线）', () => {
        expect(lineCells({ x: 0, y: 0 }, { x: 3, y: 0 }).map((c) => `${c.x},${c.y}`)).toEqual([
            '0,0',
            '1,0',
            '2,0',
            '3,0',
        ])
        expect(lineCells({ x: 2, y: 2 }, { x: 2, y: 0 }).length).toBe(3)
        // 斜线每走一步 x、y 各变 0~1，长度 = max(dx,dy)+1
        expect(lineCells({ x: 0, y: 0 }, { x: 4, y: 4 }).length).toBe(5)
        expect(lineCells({ x: 4, y: 4 }, { x: 0, y: 0 }).length).toBe(5)
    })

    it('paintLine 拖动补点：两端点之间的格都被涂上', () => {
        const out = paintLine(blankPixelMap(6, 3), { x: 0, y: 0 }, { x: 5, y: 0 }, 5)
        for (let x = 0; x <= 5; x++) expect(getCell(out, x, 0)).toBe(5)
    })

    it('fillRegion 只填同色 4 连通区域，不影响被描边隔开的另一块', () => {
        let m = blankPixelMap(5, 3)
        // 第 2 列画一条竖直描边，把左右分成两块
        m = paintLine(m, { x: 2, y: 0 }, { x: 2, y: 2 }, 1)
        const out = fillRegion(m, 0, 0, 5)
        expect(getCell(out, 0, 0)).toBe(5)
        expect(getCell(out, 1, 2)).toBe(5)
        expect(getCell(out, 2, 1)).toBe(1) // 描边不动
        expect(getCell(out, 3, 0)).toBe(0) // 对侧没被填
        expect(getCell(out, 4, 2)).toBe(0)
    })

    it('fillRegion 同色时原样返回（可用于短路刷新）', () => {
        const m = blankPixelMap(2, 2)
        expect(fillRegion(m, 0, 0, 0)).toBe(m)
    })

    it('fillAll / shiftFrame / frameSize', () => {
        const m = fillAll(blankPixelMap(3, 2), 7)
        expect(frameSize(m)).toEqual({ width: 3, height: 2 })
        expect(getCell(m, 2, 1)).toBe(7)
        const s = paintCell(blankPixelMap(4, 4), 0, 0, 5)
        const shifted = shiftFrame(s, 1, 2)
        expect(getCell(shifted, 1, 2)).toBe(5)
        expect(getCell(shifted, 0, 0)).toBe(0)
        // 移出边界就丢掉，不报错
        expect(getCell(shiftFrame(s, -1, 0), 0, 0)).toBe(0)
    })
})

describe('描边 / 光环 / 统计（编辑器的一键操作）', () => {
    it('autoOutline 只给「身体贴着背景」的格补描边，不改原帧', () => {
        const m = blankPixelMap(5, 5)
        m[2][2] = 5 // 一个孤立身体像素，四周都是背景
        const out = autoOutline(m)
        expect(getCell(out, 2, 2)).toBe(5)
        expect(getCell(out, 1, 2)).toBe(SPRITE_OUTLINE_SLOT)
        expect(getCell(out, 3, 2)).toBe(SPRITE_OUTLINE_SLOT)
        expect(getCell(out, 2, 1)).toBe(SPRITE_OUTLINE_SLOT)
        expect(getCell(out, 2, 3)).toBe(SPRITE_OUTLINE_SLOT)
        // 斜角不补（4 邻规则）
        expect(getCell(out, 1, 1)).toBe(0)
        expect(getCell(m, 1, 2)).toBe(0) // 原帧未被修改
    })

    it('autoOutline 不给已有像素染色（只填背景格）', () => {
        const out = autoOutline(DEFAULT_IDLE)
        let outline = 0
        let body = 0
        for (const row of out) {
            for (const v of row) {
                if (v === SPRITE_OUTLINE_SLOT) outline++
                else if (isBodySlot(v)) body++
            }
        }
        const before = frameStats(DEFAULT_IDLE)
        expect(outline).toBeGreaterThanOrEqual(before.outline)
        expect(body).toBe(before.body)
    })

    it('addAuraRing 只在外侧背景格加光环，可以叠厚', () => {
        const m = blankPixelMap(9, 9)
        m[4][4] = 5
        const one = addAuraRing(m)
        expect(getCell(one, 3, 4)).toBe(SPRITE_AURA_SLOT)
        expect(getCell(one, 4, 4)).toBe(5)
        expect(getCell(one, 2, 4)).toBe(0)
        const two = addAuraRing(one)
        expect(getCell(two, 2, 4)).toBe(SPRITE_AURA_SLOT)
        expect(getCell(two, 4, 4)).toBe(5)
    })

    it('frameStats 数出描边/身体/光环（现有 buff 帧有光环，idle 没有）', () => {
        const idle = frameStats(DEFAULT_IDLE)
        expect(idle.aura).toBe(0)
        expect(idle.body).toBeGreaterThan(100)
        const buff = frameStats(DEFAULT_BUFF)
        expect(buff.aura).toBeGreaterThan(0)
        expect(buff.outline).toBeGreaterThanOrEqual(idle.outline)
    })
})

describe('手部锚点：拖动 / 吸附 / 导出', () => {
    const anchor: HandAnchorData = { point: { x: 31, y: 28 }, cover: [[31, 27], [32, 27], [31, 28], [32, 28]] }
    const size = { w: 48, h: 48 }

    it('moveAnchor 把握点和遮罩一起平移，相对关系不变', () => {
        const moved = moveAnchor(anchor, 2, -3, size)
        expect(moved.point).toEqual({ x: 33, y: 25 })
        expect(moved.cover).toEqual([[33, 24], [34, 24], [33, 25], [34, 25]])
        // 握点相对遮罩左上角的偏移没变
        expect(moved.point.x - 33).toBe(anchor.point.x - 31)
        expect(moved.point.y - 24).toBe(anchor.point.y - 27)
    })

    it('moveAnchor 不会把锚点推出帧外', () => {
        const far = moveAnchor(anchor, 100, 100, size)
        expect(Math.max(...far.cover.map(([x]) => x))).toBeLessThan(size.w)
        expect(Math.max(...far.cover.map(([, y]) => y))).toBeLessThan(size.h)
        const neg = moveAnchor(anchor, -100, -100, size)
        expect(Math.min(...neg.cover.map(([x]) => x))).toBe(0)
        expect(Math.min(...neg.cover.map(([, y]) => y))).toBe(0)
        // 越界时握点也在帧内
        expect(neg.point.x).toBeGreaterThanOrEqual(0)
        expect(neg.point.y).toBeGreaterThanOrEqual(0)
    })

    it('hitAnchor 区分遮罩块与握点', () => {
        expect(hitAnchor(anchor, { x: 31, y: 27 })).toBe('cover')
        expect(hitAnchor(anchor, { x: 31, y: 28 })).toBe('cover')
        expect(hitAnchor(anchor, { x: 31, y: 29 }, 1)).toBe('point') // 握点在遮罩下方 1 格，容差 1 命中
        expect(hitAnchor(anchor, { x: 31, y: 29 }, 0)).toBe(null)
        expect(hitAnchor(anchor, { x: 5, y: 5 }, 1)).toBe(null)
    })

    it('snapAnchorToSkin 吸附到最近的 2×2 皮肤块', () => {
        const m = blankPixelMap(48, 48)
        // 在 (10,10) 画一块 2×2 皮肤
        for (const [x, y] of [[10, 10], [11, 10], [10, 11], [11, 11]]) m[y][x] = 3
        const snapped = snapAnchorToSkin(m, anchor)
        expect(snapped).not.toBeNull()
        expect(snapped!.cover).toEqual([[10, 10], [11, 10], [10, 11], [11, 11]])
        // 没有皮肤块时返回 null
        expect(snapAnchorToSkin(blankPixelMap(8, 8), anchor)).toBeNull()
    })

    it('formatAnchorSnippet 按 weapons.ts 的写法输出（含 SPRITE_PAD_LEFT）', () => {
        const snip = formatAnchorSnippet('buff', anchor, { point: { x: 41.5, y: 27.5 }, cover: [[41, 27], [42, 27], [41, 28], [42, 28]] })
        expect(snip).toContain('buff: { x: 24 + SPRITE_PAD_LEFT, y: 28 },')
        expect(snip).toContain('buff: { x: 34.5 + SPRITE_PAD_LEFT, y: 27.5 },')
        expect(snip).toContain('[24 + SPRITE_PAD_LEFT, 27],')
        expect(snip).toContain('HAND_POINTS')
        expect(snip).toContain('LEFT_HAND_COVER')
    })
})

describe('调色板删色：只留空位，下标不重排', () => {
    const palette = ['', '#111111', '#222222', '#333333', '#444444']
    // 画布上同时用了索引 1/2/4（留 3 没用，用来测"删没用的颜色"）
    const grid = [
        [1, 2, 0],
        [4, 1, 0],
    ]

    it('删掉一个没用到的颜色：只把这一格留空，别的下标位置的颜色一个都没变', () => {
        const res = removePaletteColor([grid], palette, 3)
        expect(res.blocked).toBe(false)
        expect(res.palette).toHaveLength(palette.length)
        // 逐下标比对：只有被删的那格变空，其它格（含后面的 4）原位不动
        palette.forEach((color, i) => {
            if (i === 3) expect(res.palette[i], `下标 ${i}`).toBe('')
            else expect(res.palette[i], `下标 ${i}`).toBe(color)
        })
        // 不再返回 grids：下标不变 = 任何图都不需要重映射
        expect(res).not.toHaveProperty('grids')
    })

    it('删掉最前面一个颜色（下标 1）：后面全部原位不动', () => {
        // 这组不用索引 1（否则会被"还在用"挡住）
        const g2 = [
            [2, 3, 0],
            [4, 2, 0],
        ]
        const res = removePaletteColor([g2], palette, 1)
        expect(res.blocked).toBe(false)
        expect(res.palette).toEqual(['', '', '#222222', '#333333', '#444444'])
        // 2/3/4 没有被搬到 1/2/3
        expect(res.palette[2]).toBe('#222222')
        expect(res.palette[3]).toBe('#333333')
        expect(res.palette[4]).toBe('#444444')
        expect(res).not.toHaveProperty('grids')
    })

    it('颜色还在用 → 不删，原样返回同一份 palette', () => {
        const res = removePaletteColor([grid], palette, 2)
        expect(res.blocked).toBe(true)
        expect(res.palette).toBe(palette)
        expect(res).not.toHaveProperty('grids')
    })

    it('别的图在用也算"还在用"：一份 palette 被多张图共用（武器：通用图 + 六个姿势图）', () => {
        const other = [
            [2, 0, 0],
            [0, 0, 0],
        ]
        // 当前画布没用索引 2，但另一张图用了 → 不能删（删了那张图就错位）
        const res = removePaletteColor([grid, other], palette, 2)
        expect(res.blocked).toBe(true)
        expect(res.palette).toBe(palette)
    })

    it('多张图共用时删色：下标一个不动（回归：重排会给别的图整片串色）', () => {
        const g1 = [
            [1, 2, 0],
            [4, 1, 0],
        ]
        const g2 = [
            [4, 4, 0],
            [1, 0, 0],
        ]
        const res = removePaletteColor([g1, g2], palette, 3)
        expect(res.blocked).toBe(false)
        expect(res.palette[3]).toBe('')
        // 还在用的下标 4 没有被搬到 3 → 两张图都不用改
        expect(res.palette[4]).toBe('#444444')
        expect(res).not.toHaveProperty('grids')
    })

    it('索引 0（透明）与越界不处理', () => {
        const zero = removePaletteColor([grid], palette, 0)
        expect(zero.blocked).toBe(false)
        expect(zero.palette).toBe(palette)
        const beyond = removePaletteColor([grid], palette, 99)
        expect(beyond.blocked).toBe(false)
        expect(beyond.palette).toBe(palette)
    })
})

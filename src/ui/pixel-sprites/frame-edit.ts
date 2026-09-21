/**
 * 像素帧编辑操作（编辑器用，纯函数）
 *
 * 全部返回新帧、不改原数据 —— React 里靠引用比较触发重绘，也让这些操作可单测。
 * 编辑器（DevMode 的像素编辑器）只负责把它接到鼠标事件上。
 *
 * 槽位约定同 palette.ts：0 透明 1 描边 2 发色 3 皮肤 4 瞳色 5 衣物 6 装饰 7 白 8 受击星光 9 爆气光环金边
 */
import type { PixelMap } from './types'

export const SPRITE_OUTLINE_SLOT = 1
/** 合法槽位上限（0..9，见 palette.ts） */
export const SPRITE_MAX_SLOT = 9
/** 爆气光环金边（palette 里与受击星光同为固定金黄，单独占一个槽位便于整体加/去） */
export const SPRITE_AURA_SLOT = 9

export interface Cell {
    x: number
    y: number
}

const NB: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
]

/** 身体像素（描边/高光/光环都不算） */
export function isBodySlot(v: number): boolean {
    return v >= 2 && v <= 6
}

const clone = (m: PixelMap): PixelMap => m.map((r) => [...r])

/** 取某格的值（越界当背景） */
export function getCell(map: PixelMap, x: number, y: number): number {
    if (y < 0 || y >= map.length) return 0
    if (x < 0 || x >= (map[y]?.length ?? 0)) return 0
    return map[y][x]
}

/** 帧宽高 */
export function frameSize(map: PixelMap): { width: number; height: number } {
    return { width: map[0]?.length ?? 0, height: map.length }
}

/** 两点之间的格（Bresenham），用于快速拖动时不漏格 */
export function lineCells(a: Cell, b: Cell): Cell[] {
    const out: Cell[] = []
    let x0 = a.x
    let y0 = a.y
    const dx = Math.abs(b.x - x0)
    const dy = Math.abs(b.y - y0)
    const sx = x0 < b.x ? 1 : -1
    const sy = y0 < b.y ? 1 : -1
    let err = dx - dy
    // guard 防呆：正常 Bresenham 一定在 |dx|+|dy|+1 步内结束
    for (let guard = dx + dy + 2; guard > 0; guard--) {
        out.push({ x: x0, y: y0 })
        if (x0 === b.x && y0 === b.y) break
        const e2 = 2 * err
        if (e2 > -dy) {
            err -= dy
            x0 += sx
        }
        if (e2 < dx) {
            err += dx
            y0 += sy
        }
    }
    return out
}

export interface PaintOptions {
    /** 左右镜像同时落笔（以帧中线为轴） */
    mirror?: boolean
}

/** 单点落笔（mirror 时同时画中线对侧） */
export function paintCell(map: PixelMap, x: number, y: number, value: number, options: PaintOptions = {}): PixelMap {
    const { width, height } = frameSize(map)
    const out = clone(map)
    const put = (px: number, py: number) => {
        if (px < 0 || px >= width || py < 0 || py >= height) return
        out[py][px] = value
    }
    put(x, y)
    if (options.mirror) put(width - 1 - x, y)
    return out
}

/** 沿直线落笔（拖动时用；含镜像） */
export function paintLine(map: PixelMap, from: Cell, to: Cell, value: number, options: PaintOptions = {}): PixelMap {
    let out = map
    for (const c of lineCells(from, to)) out = paintCell(out, c.x, c.y, value, options)
    return out
}

/** 油漆桶：4 连通区域填充（不镜像 —— 镜像填充语义不清，容易误伤） */
export function fillRegion(map: PixelMap, x: number, y: number, value: number): PixelMap {
    const { width, height } = frameSize(map)
    const target = getCell(map, x, y)
    if (target === value) return map
    const out = clone(map)
    const stack: Cell[] = [{ x, y }]
    while (stack.length) {
        const c = stack.pop()!
        if (c.x < 0 || c.x >= width || c.y < 0 || c.y >= height) continue
        if (out[c.y][c.x] !== target) continue
        out[c.y][c.x] = value
        stack.push({ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 })
    }
    return out
}

/** 把整帧替换成给定值（清空/填充全帧用） */
export function fillAll(map: PixelMap, value: number): PixelMap {
    return map.map((row) => row.map(() => value))
}

/** 把非 0 像素整体平移（dx,dy），越界丢弃（对齐底稿时用） */
export function shiftFrame(map: PixelMap, dx: number, dy: number): PixelMap {
    const { width, height } = frameSize(map)
    const out: PixelMap = Array.from({ length: height }, () => new Array<number>(width).fill(0))
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
            out[ny][nx] = map[y][x]
        }
    }
    return out
}

/**
 * 自动描边：身体像素(2..6)的 4 邻若是背景就补描边(1)。
 * 手画时逐格描边容易漏（斜边、手部拐角），这个按钮负责兜底；只在背景处补，不会覆盖已有像素。
 */
export function autoOutline(map: PixelMap): PixelMap {
    const { width, height } = frameSize(map)
    const out = clone(map)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!isBodySlot(out[y][x])) continue
            for (const [dx, dy] of NB) {
                const nx = x + dx
                const ny = y + dy
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
                if (out[ny][nx] === 0) out[ny][nx] = SPRITE_OUTLINE_SLOT
            }
        }
    }
    return out
}

/**
 * 加金边（爆气光环）：所有非空像素的 4 邻背景格涂成光环槽位。
 * 需要更厚的光环就重复调用（每调用一次向外扩一圈）。
 */
export function addAuraRing(map: PixelMap, slot: number = SPRITE_AURA_SLOT): PixelMap {
    const { width, height } = frameSize(map)
    const out = clone(map)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (map[y][x] === 0) continue
            for (const [dx, dy] of NB) {
                const nx = x + dx
                const ny = y + dy
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
                if (out[ny][nx] === 0) out[ny][nx] = slot
            }
        }
    }
    return out
}

/**
 * 手部锚点数据（源图坐标）：一个握点 + 一组遮罩格。
 * 与 weapons.ts 的 HAND_POINTS / HAND_COVER（内容坐标 + SPRITE_PAD_LEFT）一一对应。
 */
export interface HandAnchorData {
    point: { x: number; y: number }
    cover: [number, number][]
}

/** 整体平移一个锚点（握点与遮罩一起移，保持两者相对关系）；越界就夹在帧内 */
export function moveAnchor(anchor: HandAnchorData, dx: number, dy: number, size: { w: number; h: number }): HandAnchorData {
    let sx = dx
    let sy = dy
    if (anchor.cover.length > 0) {
        const minX = Math.min(...anchor.cover.map(([x]) => x))
        const maxX = Math.max(...anchor.cover.map(([x]) => x))
        const minY = Math.min(...anchor.cover.map(([, y]) => y))
        const maxY = Math.max(...anchor.cover.map(([, y]) => y))
        // 用遮罩边界反推允许的位移，保证整组锚点（含握点）都留在帧内
        sx = Math.min(Math.max(dx, -minX), size.w - 1 - maxX)
        sy = Math.min(Math.max(dy, -minY), size.h - 1 - maxY)
    }
    return {
        point: { x: anchor.point.x + sx, y: anchor.point.y + sy },
        cover: anchor.cover.map(([x, y]) => [x + sx, y + sy] as [number, number]),
    }
}

/** 命中测试：点在遮罩块上算 cover，点在握点（±tolerance）算 point */
export function hitAnchor(anchor: HandAnchorData, cell: Cell, tolerance = 0): 'point' | 'cover' | null {
    const key = `${cell.x},${cell.y}`
    if (anchor.cover.some(([x, y]) => `${x},${y}` === key)) return 'cover'
    const dx = Math.abs(cell.x - Math.round(anchor.point.x))
    const dy = Math.abs(cell.y - Math.round(anchor.point.y))
    if (dx <= tolerance && dy <= tolerance) return 'point'
    return null
}

/**
 * 把锚点吸附到最近的「2×2 全是皮肤」的位置（画完手之后一键对齐）。
 * 保持握点相对遮罩左上角的偏移不变；找不到 2×2 皮肤块时返回 null。
 */
export function snapAnchorToSkin(map: PixelMap, anchor: HandAnchorData, skinSlot = 3): HandAnchorData | null {
    const { width: w, height: h } = frameSize(map)
    const blocks: { x: number; y: number }[] = []
    for (let y = 0; y + 1 < h; y++) {
        for (let x = 0; x + 1 < w; x++) {
            if (
                map[y][x] === skinSlot &&
                map[y][x + 1] === skinSlot &&
                map[y + 1][x] === skinSlot &&
                map[y + 1][x + 1] === skinSlot
            ) {
                blocks.push({ x, y })
            }
        }
    }
    if (blocks.length === 0) return null
    const left = Math.min(...anchor.cover.map(([x]) => x))
    const top = Math.min(...anchor.cover.map(([, y]) => y))
    const offX = anchor.point.x - left
    const offY = anchor.point.y - top
    let best = blocks[0]
    let bestD = Number.MAX_SAFE_INTEGER
    for (const b of blocks) {
        const d = Math.abs(b.x - left) + Math.abs(b.y - top)
        if (d < bestD) {
            bestD = d
            best = b
        }
    }
    return {
        point: { x: best.x + offX, y: best.y + offY },
        cover: [
            [best.x, best.y],
            [best.x + 1, best.y],
            [best.x, best.y + 1],
            [best.x + 1, best.y + 1],
        ],
    }
}

/** 2×2 遮罩块：从一个左上角生成四个格（拖动时统一用这个形状） */
export function coverBlock(x: number, y: number): [number, number][] {
    return [
        [x, y],
        [x + 1, y],
        [x, y + 1],
        [x + 1, y + 1],
    ]
}

export interface FrameStats {
    width: number
    height: number
    outline: number
    body: number
    aura: number
}

/** 像素统计（编辑器用来显示描边/身体/光环格数） */
export function frameStats(map: PixelMap): FrameStats {
    let outline = 0
    let body = 0
    let aura = 0
    for (const row of map) {
        for (const v of row) {
            if (v === SPRITE_OUTLINE_SLOT) outline++
            else if (v === SPRITE_AURA_SLOT) aura++
            else if (isBodySlot(v)) body++
        }
    }
    return { width: map[0]?.length ?? 0, height: map.length, outline, body, aura }
}

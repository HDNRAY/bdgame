import {
    POSE_NAMES,
    SPRITE_HEIGHT,
    SPRITE_PAD_LEFT,
    SPRITE_WIDTH,
    WEAPON_ARTS,
    WEAPON_HEIGHT,
    WEAPON_OVERLAYS,
    WEAPON_WIDTH,
    blankPixelMap,
    parseEditorState,
    resolveWeaponPixels,
} from '../../../../pixel-sprites'
import type { PixelEditorSavedState, PixelMap, WeaponOverlay } from '../../../../pixel-sprites'
import { EDITOR_STATE_KEY } from './constants'

/** 判断底板亮不亮（网格线/hover 框取反色才看得见） */
export function isLightColor(hex: string): boolean {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (!m) return false
    const n = parseInt(m[1], 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

/** 由基色生成棋盘的另一格（亮底压暗、暗底提亮） */
export function backdropPartner(base: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(base)
    if (!m) return base
    const n = parseInt(m[1], 16)
    const shift = isLightColor(base) ? -16 : 16
    const clamp = (v: number) => Math.max(0, Math.min(255, v))
    const r = clamp(((n >> 16) & 255) + shift)
    const g = clamp(((n >> 8) & 255) + shift)
    const b = clamp((n & 255) + shift)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export const cloneMap = (m: PixelMap): PixelMap => m.map((r) => [...r])

/** 预览用：按 padSprite 的规则补左侧留白（预览 = 游戏里的渲染结果） */
export function padForPreview(map: PixelMap): PixelMap {
    const out: PixelMap = Array.from({ length: SPRITE_HEIGHT }, () => new Array<number>(SPRITE_WIDTH).fill(0))
    for (let y = 0; y < Math.min(map.length, SPRITE_HEIGHT); y++) {
        for (let x = 0; x < map[y].length; x++) {
            const px = x + SPRITE_PAD_LEFT
            if (px >= SPRITE_WIDTH) break
            out[y][px] = map[y][x]
        }
    }
    return out
}

/** 网格上有没有画东西（决定姿势按钮「已填/未填」与 art 块是否导出） */
export function gridHasPixels(grid: PixelMap): boolean {
    return grid.some((row) => row.some((v) => v > 0))
}

/**
 * 武器美术 → 通用图 + 六张姿势图 + **共用的一份**调色板（下标 0 占位）。
 * 六张图与通用图的颜色都进同一个 palette / 同一套下标，符合「每把武器只有一份 palette」的约定。
 */
export function weaponArtToGrids(weaponId: string): {
    grid: PixelMap
    poses: Record<string, PixelMap>
    palette: string[]
} {
    const palette: string[] = ['']
    const index = new Map<string, number>()
    const idxOf = (color: string): number => {
        const found = index.get(color)
        if (found !== undefined) return found
        palette.push(color)
        const idx = palette.length - 1
        index.set(color, idx)
        return idx
    }
    const toGrid = (overlay?: WeaponOverlay): PixelMap => {
        const grid = blankPixelMap(WEAPON_WIDTH, WEAPON_HEIGHT)
        if (overlay) {
            for (const [x, y, color] of resolveWeaponPixels(overlay)) {
                if (x >= 0 && x < WEAPON_WIDTH && y >= 0 && y < WEAPON_HEIGHT) grid[y][x] = idxOf(color)
            }
        }
        return grid
    }
    const grid = toGrid(WEAPON_OVERLAYS[weaponId])
    const poses: Record<string, PixelMap> = {}
    for (const pose of POSE_NAMES) poses[pose] = toGrid(WEAPON_ARTS[weaponId]?.[pose])
    return { grid, poses, palette }
}

/** 武器图 → 可下载/可再导入的 JSON（颜色直接写色值） */
export function weaponGridToJson(grid: PixelMap, palette: string[]): string {
    const pixels: [number, number, string][] = []
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const v = grid[y][x]
            if (v > 0 && palette[v]) pixels.push([x, y, palette[v]])
        }
    }
    return JSON.stringify({ pixels, palette: {} }, null, 1)
}

/** 读一次本地存档（页面重载 / Vite 重载后恢复；读写失败都当没有） */
export function readSavedState(): PixelEditorSavedState | null {
    try {
        if (typeof localStorage === 'undefined') return null
        return parseEditorState(localStorage.getItem(EDITOR_STATE_KEY))
    } catch {
        return null
    }
}

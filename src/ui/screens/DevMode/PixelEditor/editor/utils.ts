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
    removePaletteColor,
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
 * 剪贴板里那张图能不能贴进当前槽。
 *
 * 编辑器同时编辑两种尺寸的画布（身体帧 48×48、武器图 32×32），而 `setActive` 是
 * 「写当前槽」的统一入口 —— 尺寸不符硬贴会把画布整块换成错的尺寸（帧尺寸是从数据推出来的）。
 * 所以只允许同尺寸粘贴，不做裁切/补白（那种"悄悄丢一半"的行为更难查）。
 * 同尺寸覆盖了真实工作流：武器图 idle→attack、通用→某个姿势、身体帧→身体帧。
 *
 * @param clip - 剪贴板内容（还没有就传 null/undefined）。
 * @param target - 当前槽的网格。
 * @returns 能贴返回 true（不写成类型谓词：调用方已经自己查过"空剪贴板"，谓词反而会把那边窄成 never）。
 */
export function canPasteInto(clip: PixelMap | null | undefined, target: PixelMap): boolean {
    if (!clip || clip.length === 0) return false
    return clip.length === target.length && clip[0].length === target[0]?.length
}

/**
 * 删掉武器调色板里的一个颜色 —— **只把那个下标留空，绝不重排**。
 *
 * 一把武器只有一套下标（下标 = 文件里 palette 的键），七张图共用它。
 * 所以"删掉一个颜色"唯一安全的做法就是让它空着：别的下标一个都不动，
 * 七张图不需要重映射，"删个颜色图就错位"这类问题从构造上不可能发生。
 * 还有图在用这个颜色时不允许删（空位上的像素会解析成洋红）。
 *
 * @param grid - 通用图（overlay）。
 * @param poses - 逐姿势美术表（六个姿势）。
 * @param palette - 共用调色板。
 * @param idx - 要留空的下标。
 * @returns 新的调色板；`blocked: true` 表示还有图在用，原样返回。
 */
export function removeWeaponPaletteColor(
    grid: PixelMap,
    poses: Record<string, PixelMap>,
    palette: string[],
    idx: number,
): { palette: string[]; blocked: boolean } {
    const res = removePaletteColor([grid, ...POSE_NAMES.map((pose) => poses[pose])], palette, idx)
    return res.blocked ? { palette, blocked: true } : { palette: res.palette, blocked: false }
}

/** 第一个空位（>=1），没有就返回末尾 —— 加色 / 解析颜色字面量都用它，空位会被重新填上 */
export function firstFreeSlot(palette: string[]): number {
    for (let i = 1; i < palette.length; i++) if (!palette[i]) return i
    return palette.length
}

/** 两份调色板是不是同一份（下标一一对应、颜色相同；空位也按空位比） */
export function samePalette(a: string[], b: string[]): boolean {
    const n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) if ((a[i] ?? '') !== (b[i] ?? '')) return false
    return true
}

/**
 * 武器美术 → 通用图 + 六张姿势图 + **共用的一份**调色板。
 *
 * 一把武器只有**一套下标**：下标就是武器文件里 palette 的键，编辑器原样沿用、**不重新排号**。
 * 于是导出的 `pixels` 直接能贴回文件（块里不必再带 palette），删色也不必搬别处的下标。
 * 颜色字面量写法（`[x, y, '#rrggbb']`）会先查已有颜色；查不到就补到第一个空位。
 */
export function weaponArtToGrids(weaponId: string): {
    grid: PixelMap
    poses: Record<string, PixelMap>
    palette: string[]
} {
    const blocks = [WEAPON_OVERLAYS[weaponId], ...POSE_NAMES.map((pose) => WEAPON_ARTS[weaponId]?.[pose])]
    // 各块写明的 palette：键 = 下标，直接落座（块之间应当同一份；不一致时先写的优先、缺的键补齐）
    const palette: string[] = ['']
    for (const block of blocks) {
        for (const [key, color] of Object.entries(block?.palette ?? {})) {
            const i = Number(key)
            if (!Number.isInteger(i) || i <= 0 || palette[i] !== undefined) continue
            palette[i] = color
        }
    }
    const indexOfColor = (color: string): number => {
        const wanted = color.toLowerCase()
        for (let i = 1; i < palette.length; i++) if (palette[i]?.toLowerCase() === wanted) return i
        const free = firstFreeSlot(palette)
        palette[free] = color
        return free
    }
    const toGrid = (block?: WeaponOverlay): PixelMap => {
        const grid = blankPixelMap(WEAPON_WIDTH, WEAPON_HEIGHT)
        // 直接读原始 pixels（resolveWeaponPixels 会把下标换成颜色，这里必须保住下标）
        for (const [x, y, color] of block?.pixels ?? []) {
            if (x < 0 || x >= WEAPON_WIDTH || y < 0 || y >= WEAPON_HEIGHT) continue
            grid[y][x] = typeof color === 'number' ? color : indexOfColor(color)
        }
        return grid
    }
    const grid = toGrid(WEAPON_OVERLAYS[weaponId])
    const poses: Record<string, PixelMap> = {}
    for (const pose of POSE_NAMES) poses[pose] = toGrid(WEAPON_ARTS[weaponId]?.[pose])
    return { grid, poses, palette }
}

/**
 * 编辑器武器图的初始视图：**文件是底色，存档只盖它真记过的东西**。
 *
 * 老存档没有 `poses` 那一层（逐姿势美术是后加进武器文件的）。以前这里会把六个姿势一律清空，
 * 等于让一份旧存档把文件里的图挡在外面 —— 姿势按钮显示「未」、画布空白，导出还会退回 overlay 块。
 * 现在逐姿势一律回落到文件，只有存档自己**真画过**的姿势才用存档那张；通用图仍用存档里那张
 * （那是用户在改的稿，存档存在的意义就是不丢它）。
 *
 * 判定「真画过」而不是「字段在不在」，是因为旧逻辑清空后会自动存成六张空图 ——
 * 只看字段存在与否，那种已经被污染的存档仍然会把文件挡住。六个姿势一个像素都没有，
 * 就当作「这份存档没记过逐姿势美术」整体回落到文件；只清了某几个的仍尊重存档。
 *
 * 两边各有一份调色板（下标 0 占位），且顺序/长短都可能不同，所以以文件那份为基底、
 * 把存档多出来的颜色追加在后面，再把**存档里的网格**按颜色重映射过去，否则旧下标会串色。
 */
export function initialWeaponView(
    saved: PixelEditorSavedState | null,
    fallbackId: string,
): { id: string; grid: PixelMap; poses: Record<string, PixelMap>; palette: string[] } {
    const id = saved?.weapon.id ?? fallbackId
    const fromFile = weaponArtToGrids(id)
    if (!saved) {
        return {
            id,
            grid: cloneMap(fromFile.grid),
            poses: Object.fromEntries(POSE_NAMES.map((pose) => [pose, cloneMap(fromFile.poses[pose])])),
            palette: [...fromFile.palette],
        }
    }

    const palette = [...fromFile.palette]
    const index = new Map<string, number>()
    palette.forEach((color, i) => {
        if (i > 0 && color !== '') index.set(color, i)
    })
    /** 存档网格的下标（指向存档调色板）→ 合成调色板的下标 */
    const remap = (grid: PixelMap): PixelMap =>
        grid.map((row) =>
            row.map((v) => {
                const color = saved.weapon.palette[v]
                if (v === 0 || color === undefined || color === '') return 0
                const found = index.get(color)
                if (found !== undefined) return found
                palette.push(color)
                index.set(color, palette.length - 1)
                return palette.length - 1
            }),
        )

    const savedPoses = saved.weapon.poses
    const savedAnyPose = POSE_NAMES.some((pose) => {
        const own = savedPoses?.[pose]
        return own !== undefined && gridHasPixels(own)
    })
    const poses: Record<string, PixelMap> = {}
    for (const pose of POSE_NAMES) {
        const own = savedAnyPose ? savedPoses?.[pose] : undefined
        poses[pose] = own === undefined ? cloneMap(fromFile.poses[pose]) : remap(own)
    }
    return { id, grid: remap(saved.weapon.grid), poses, palette }
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

/**
 * 武器美术叠加层的查询与像素解析（纯美术，与挂点无关）。
 *
 * 逐姿势美术（`art`）与通用图（`overlay`）的取图链只有这里一个入口：
 * `art[pose] → art.idle → overlay`（空条目 / 空 pixels 视为「没有」，继续往下塌）。
 * 所有按姿势渲染武器的地方都走 getWeaponArt，不要各写一套。
 *
 * **一把武器只有一份调色板**：它声明在通用图（`overlay.palette`）上，姿势块自己不写，
 * 取图时由这里兜上去（见 `withSharedPalette`）。所以「一份调色板 + 一套下标」是数据层面的事实，
 * 而不是靠约定维持 —— 导出片段也因此不必再带 palette。
 */
import type { WeaponArtTable, WeaponOverlay } from '../types'
import { WEAPON_ARTS, WEAPON_OVERLAYS } from './entries/index'

/** 根据武器 ID 获取叠加层（纯美术，不区分姿势） */
export function getWeaponOverlay(weaponId: string): WeaponOverlay {
    return WEAPON_OVERLAYS[weaponId] ?? WEAPON_OVERLAYS.bare_hands
}

/** 这张图有没有可画像素（空对象 / 空 pixels 都视为「没有」） */
function drawable(overlay: WeaponOverlay | undefined): overlay is WeaponOverlay {
    return Boolean(overlay && Array.isArray(overlay.pixels) && overlay.pixels.length > 0)
}

/**
 * 把「这把武器共用的那份调色板」兜到块上。
 *
 * 块自己写了 `palette` 就以它为准（老武器文件、测试里临时合成的条目都还这么写）；
 * 没写就继承通用图那份 —— 姿势块于是在文件里可以只写 `pixels`，下标仍指向同一套颜色。
 * 一份都没有时原样返回（像素会解析成洋红，等于明确画错了）。
 */
function withSharedPalette(block: WeaponOverlay | undefined, weaponId: string): WeaponOverlay | undefined {
    if (!block || block.palette !== undefined) return block
    const shared = WEAPON_OVERLAYS[weaponId]?.palette
    return shared === undefined ? block : { ...block, palette: shared }
}

/**
 * 取某姿势的武器美术：`art[pose] → art.idle → overlay`（调色板已按上面的规则兜好）。
 * 逐级都为空时返回 undefined（= 没有任何可画的像素）；没有 art 字段的武器结果与
 * `getWeaponOverlay` 完全等价（有像素时返回的就是同一个对象）。
 */
export function getWeaponArt(weaponId: string, pose: string): WeaponOverlay | undefined {
    const art: WeaponArtTable | undefined = WEAPON_ARTS[weaponId]
    const posed = art?.[pose]
    if (drawable(posed)) return withSharedPalette(posed, weaponId)
    const idle = art?.idle
    if (drawable(idle)) return withSharedPalette(idle, weaponId)
    const base = WEAPON_OVERLAYS[weaponId] ?? WEAPON_OVERLAYS.bare_hands
    return drawable(base) ? base : undefined
}

/** 该武器有没有任何可画的美术（通用图或任一姿势图）——编辑器列表 / 查看器用 */
export function weaponHasArt(weaponId: string): boolean {
    if (drawable(WEAPON_OVERLAYS[weaponId])) return true
    const art = WEAPON_ARTS[weaponId]
    if (!art) return false
    return Object.values(art).some((overlay) => drawable(overlay))
}

/** 解析武器像素颜色：字符串直接用，数字索引查调色盘 */
export function getWeaponPixelColor(overlay: WeaponOverlay, colorOrIndex: string | number): string {
    if (typeof colorOrIndex === 'string') return colorOrIndex
    return overlay.palette?.[String(colorOrIndex)] ?? '#ff00ff'
}

/** 解析武器所有像素为 [x, y, color]（数字索引查 palette 转成颜色字符串） */
export function resolveWeaponPixels(overlay: WeaponOverlay): [number, number, string][] {
    return overlay.pixels.map(([x, y, c]) => [x, y, getWeaponPixelColor(overlay, c)])
}

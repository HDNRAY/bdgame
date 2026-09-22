/**
 * 武器美术叠加层的查询与像素解析（纯美术，与挂点无关）。
 *
 * 逐姿势美术（`art`）与通用图（`overlay`）的取图链只有这里一个入口：
 * `art[pose] → art.idle → overlay`（空条目 / 空 pixels 视为「没有」，继续往下塌）。
 * 所有按姿势渲染武器的地方都走 getWeaponArt，不要各写一套。
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
 * 取某姿势的武器美术：`art[pose] → art.idle → overlay`。
 * 逐级都为空时返回 undefined（= 没有任何可画的像素）；没有 art 字段的武器结果与
 * `getWeaponOverlay` 完全等价（有像素时返回的就是同一个对象）。
 */
export function getWeaponArt(weaponId: string, pose: string): WeaponOverlay | undefined {
    const art: WeaponArtTable | undefined = WEAPON_ARTS[weaponId]
    const posed = art?.[pose]
    if (drawable(posed)) return posed
    const idle = art?.idle
    if (drawable(idle)) return idle
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

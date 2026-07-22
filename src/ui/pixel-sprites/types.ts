/** 像素精灵 — 类型定义 */

export type Palette = Record<string, string>
export type PixelMap = number[][]

export interface PixelSprite {
    palette: Palette
    frames: Record<string, PixelMap>
}

export interface AvatarData {
    palette: Palette
    pixels: PixelMap
    scale: number
}

export interface WeaponOverlay {
    pixels: [number, number, string][] // [x, y, color] — 相对于武器原点
    /** 握柄 X（武器自身坐标），对齐到角色手部 */
    gripX: number
    /** 握柄 Y */
    gripY: number
}

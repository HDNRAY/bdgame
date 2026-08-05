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

/** 武器像素颜色：可直接是颜色字符串，或调色盘索引（数字） */
export type WeaponPixelColor = string | number

export interface WeaponOverlay {
    /** 武器像素 [x, y, color] — 32×32 坐标系，相对武器原点。color 为颜色字符串或 palette 索引 */
    pixels: [number, number, WeaponPixelColor][]
    /** 可选调色盘：pixels 用数字索引时查此表；不提供则像素直接存颜色字符串 */
    palette?: Palette
    /** 第一握柄 X（武器自身坐标），对齐到角色手部 */
    gripX: number
    /** 第一握柄 Y */
    gripY: number
    /** 第二握柄 X（双手武器）— 可选 */
    grip2X?: number
    /** 第二握柄 Y — 可选 */
    grip2Y?: number
}

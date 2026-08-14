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
}

/** 每武器·每姿势的握持配置（独立于武器美术，见 weapons.ts WEAPON_POSES） */
export interface WeaponPoseConfig {
    /** 第一握柄 X（武器自身坐标），对齐到角色手部 */
    gripX: number
    /** 第一握柄 Y */
    gripY: number
    /** 第二握柄 X（双手武器）— 可选 */
    grip2X?: number
    /** 第二握柄 Y — 可选 */
    grip2Y?: number
    /** 覆盖锚定手位置 X（角色精灵坐标）— 不填则用 anchorHand/全局手部表 */
    handX?: number
    /** 覆盖锚定手位置 Y（角色精灵坐标） */
    handY?: number
    /** 锚定哪只手：'main'=主手(HAND_POINTS)、'off'=副手(OTHER_HAND_POINT)；默认单手=main、双手=off */
    anchorHand?: 'main' | 'off'
    /** 该姿势最终旋转角（弧度）— 覆盖自动规则，朝左镜像取反 */
    angle?: number
    /** 无手部覆盖层 — 漂浮类武器（如法珠）无需"握着"的皮肤盖片 */
    noHandCover?: boolean
}

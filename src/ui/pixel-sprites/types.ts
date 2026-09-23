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

/**
 * 逐姿势美术：键是姿势名（idle/attack/dodge/parry/hit/buff），值是那个姿势的一张图。
 * 只写需要的姿势，缺项 = 该姿势没有专门图（渲染时按 `art[pose] → art.idle → overlay` 坍缩）。
 * 调色盘约定：每把武器仍只有一份 palette，六张图共用。
 */
export type WeaponArtTable = Partial<Record<string, WeaponOverlay>>

/** 每武器·每姿势的握持配置（独立于武器美术，见 weapons.ts WEAPON_POSES） */
export interface WeaponPoseConfig {
    /** 第一握柄 X（武器自身坐标），对齐到角色手部 */
    gripX: number
    /** 第一握柄 Y */
    gripY: number
    /** 逐姿势：握柄相对武器握点（基底 gripX/gripY）的偏移 X —— 武器端只有「一个握点」，姿势要调就写偏移 */
    gripDX?: number
    /** 逐姿势：握柄偏移 Y */
    gripDY?: number
    /** 覆盖锚定手位置 X（角色精灵坐标）— 不填则用 anchorHand/全局手部表 */
    handX?: number
    /** 覆盖锚定手位置 Y（角色精灵坐标） */
    handY?: number
    /** 相对「基准手位」的偏移 X（基准 = HAND_POINTS[pose] 或副手/双手锚点）——优先于全局表，低于绝对 handX/handY */
    handDX?: number
    /** 相对「基准手位」的偏移 Y */
    handDY?: number
    /** 锚定哪只手：'main'=主手(HAND_POINTS)、'off'=副手(OTHER_HAND_POINT)；默认单手=main、双手=off */
    anchorHand?: 'main' | 'off'
    /** 该姿势最终旋转角（弧度）— 覆盖自动规则，朝左镜像取反 */
    angle?: number
    /**
     * 左右镜像：把**画出来的**武器沿「过握点的竖轴」左右翻转（手性颠倒），姿势角度配置不变 ——
     * 即「先按该姿势角度旋转、再把画面左右翻」。数据键名仍叫 `flip`（历史原因：它曾经是
     * 「最终角度 +180°」的转半圈开关；改名会打坏所有武器文件与存档）。解析结果字段是 `WeaponMount.mirror`。
     */
    flip?: boolean
    /**
     * 是否在武器上盖「握着」的手部皮肤遮罩；不填 = true（盖）。
     * 与 flip 同级：写在 poses 基底里是整把武器的默认，单个姿势条目可覆盖。
     * 给"甲片本身就是手"的武器（拳套/护手类）关掉用 —— 那种武器的手由美术自己负责画。
     * hit 姿势无论这里写什么都 **不盖**（武器脱手，见 shouldDrawHandCover）。
     */
    handCover?: boolean
}

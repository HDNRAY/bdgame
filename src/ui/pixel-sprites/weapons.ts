/** 武器叠加层 */

import type { WeaponOverlay } from './types'
import { SPRITE_PAD_LEFT } from './constants'
/** 各姿势右手握柄位置（角色精灵坐标，网格尺寸见 constants.ts SPRITE_WIDTH×SPRITE_HEIGHT） */
export const HAND_POINTS: Record<string, { x: number; y: number }> = {
    idle: { x: 30 + SPRITE_PAD_LEFT, y: 32 },
    attack: { x: 16 + SPRITE_PAD_LEFT, y: 29 },
}

/**
 * 各姿势副手（左手，图中右侧）握点位置（角色精灵坐标，取 LEFT_HAND_COVER 中心）。
 * 双手武器的主握点（gripX/gripY）锚定于此；棍身轴线须穿过主手。
 */
export const OTHER_HAND_POINT: Record<string, { x: number; y: number }> = {
    idle: { x: 52.5, y: 31.5 },
    attack: { x: 42, y: 25.5 },
}

/** 各姿势手部覆盖像素（人物精灵坐标）— 用角色皮肤色绘制在握柄上方，制造"握着"效果 */
export const HAND_COVER: Record<string, [number, number][]> = {
    idle: [
        [30 + SPRITE_PAD_LEFT, 31],
        [31 + SPRITE_PAD_LEFT, 31],
        [30 + SPRITE_PAD_LEFT, 32],
        [31 + SPRITE_PAD_LEFT, 32],
    ],
    attack: [
        [15 + SPRITE_PAD_LEFT, 27],
        [16 + SPRITE_PAD_LEFT, 27],
        [17 + SPRITE_PAD_LEFT, 27],
        [15 + SPRITE_PAD_LEFT, 28],
        [16 + SPRITE_PAD_LEFT, 28],
        [17 + SPRITE_PAD_LEFT, 28],
    ],
}

/**
 * 各姿势第二只手（左手）覆盖像素（人物精灵坐标）— 双手武器（有 grip2）用皮肤色盖住第二握点。
 * idle 左手在角色右侧 4 格：52,29 53,29 52,30 53,30；attack：41,24 42,24 42,25 43,25。
 */
export const LEFT_HAND_COVER: Record<string, [number, number][]> = {
    idle: [
        [52, 31],
        [53, 31],
        [52, 32],
        [53, 32],
    ],
    attack: [
        [41, 26],
        [41, 25],
        [42, 25],
        [42, 26],
        [43, 26],
    ],
}

export const WEAPON_OVERLAYS: Record<string, WeaponOverlay> = {
    bare_hands: { pixels: [], gripX: 0, gripY: 0 },
    fist: {
        gripX: 8,
        gripY: 0,
        pixels: [
            [8, 0, '#ffd700'],
            [9, 0, '#ffd700'],
        ],
    },
    sword: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [8, 3, '#e8e8e8'],
            [9, 3, '#e8e8e8'],
            [9, 4, '#d0d0d0'],
            [10, 4, '#e8e8e8'],
            [10, 5, '#d0d0d0'],
            [11, 6, '#d0d0d0'],
            [7, 7, '#b8860b'],
            [8, 7, '#daa520'],
            [9, 7, '#b8860b'],
        ],
    },
    spear: {
        gripX: 10,
        gripY: 6,
        pixels: [
            [10, 3, '#996633'],
            [10, 4, '#996633'],
            [10, 5, '#996633'],
            [10, 6, '#996633'],
            [10, 7, '#996633'],
            [9, 2, '#e0e0e0'],
            [10, 2, '#e0e0e0'],
            [11, 2, '#e0e0e0'],
        ],
    },
    zantetsu: {
        gripX: 9,
        gripY: 7,
        pixels: [
            [9, 0, '#3a3a3a'],
            [10, 1, '#3a3a3a'],
            [10, 2, '#4a4a4a'],
            [11, 2, '#3a3a3a'],
            [11, 3, '#4a4a4a'],
            [12, 4, '#3a3a3a'],
            [12, 5, '#4a4a4a'],
            [13, 6, '#3a3a3a'],
            [8, 7, '#ffd700'],
            [9, 7, '#ffed4e'],
            [10, 7, '#ffd700'],
        ],
    },
    ciyuan_blade: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [7, 2, '#b366ff'],
            [8, 3, '#b366ff'],
            [8, 4, '#a855ff'],
            [9, 4, '#b366ff'],
            [9, 5, '#a855ff'],
            [10, 6, '#b366ff'],
            [7, 7, '#ffed4e'],
            [8, 7, '#ffed4e'],
        ],
    },
    overlord_blade: {
        gripX: 9,
        gripY: 7,
        pixels: [
            [9, 1, '#ff5555'],
            [10, 2, '#ff5555'],
            [10, 3, '#dd3333'],
            [11, 3, '#ff5555'],
            [11, 4, '#dd3333'],
            [12, 5, '#ff5555'],
            [12, 6, '#dd3333'],
            [8, 7, '#1a1a1a'],
            [9, 7, '#1a1a1a'],
            [10, 7, '#1a1a1a'],
        ],
    },
    tri_orb: {
        gripX: 7,
        gripY: 6,
        pixels: [
            [9, 3, '#ff6b6b'],
            [10, 3, '#ff6b6b'],
            [9, 4, '#ff6b6b'],
            [10, 4, '#e74c3c'],
            [2, 7, '#5dade2'],
            [3, 7, '#5dade2'],
            [2, 8, '#5dade2'],
            [3, 8, '#3498db'],
            [11, 7, '#52d273'],
            [12, 7, '#52d273'],
            [11, 8, '#52d273'],
            [12, 8, '#2ecc71'],
        ],
    },
    xiu_dong: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [5, 4, '#a8d8ff'],
            [6, 4, '#a8d8ff'],
            [6, 5, '#c9e4ff'],
            [7, 6, '#c9e4ff'],
            [5, 7, '#7fb3d5'],
            [9, 7, '#7fb3d5'],
        ],
    },
    chun_lei: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [5, 4, '#a8d8ff'],
            [6, 4, '#a8d8ff'],
            [6, 5, '#c9e4ff'],
            [7, 6, '#c9e4ff'],
            [9, 4, '#a8d8ff'],
            [10, 4, '#a8d8ff'],
            [10, 5, '#c9e4ff'],
            [5, 7, '#7fb3d5'],
            [9, 7, '#7fb3d5'],
        ],
    },
    heshan_sword: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [8, 3, '#ffb366'],
            [9, 3, '#ffb366'],
            [9, 4, '#ff9944'],
            [10, 5, '#ffb366'],
            [10, 6, '#ff9944'],
            [7, 7, '#ff6b6b'],
            [8, 7, '#ff6b6b'],
        ],
    },
    dagger: {
        gripX: 8,
        gripY: -3,
        pixels: [
            [7, -2, '#d8d8d8'],
            [8, -1, '#d8d8d8'],
            [9, 0, '#d8d8d8'],
            [10, 1, '#d8d8d8'],
            [8, -3, '#996633'],
        ],
    },
    iron_spear: {
        gripX: 10,
        gripY: -3,
        pixels: [
            [10, -6, '#996633'],
            [10, -5, '#996633'],
            [10, -4, '#996633'],
            [10, -3, '#996633'],
            [10, -2, '#996633'],
            [10, -1, '#996633'],
            [9, -7, '#c0c0c0'],
            [11, -7, '#c0c0c0'],
        ],
    },
    // ── 32×32 坐标系（剑尖/棍尖朝左上，握柄在右下）──
    peach_sword: {
        gripX: 24,
        gripY: 24,
        palette: {
            '0': '#e8b078', // 剑身 亮
            '1': '#dba870', // 剑身 暗
            '2': '#f2d5b0', // 剑身 最亮
            '3': '#ffb6c1', // 护手 粉
            '4': '#ff9fb2', // 护手 深粉
            '5': '#8a5a3a', // 剑柄 亮
            '6': '#6b3a1a', // 剑柄 暗
        },
        pixels: [
            // 剑身：3 格宽，逐行错位 1 格（45° 斜线），前格亮 / 中格主色 / 后格暗
            // [6, 6, 2],
            // [7, 6, 0],
            // [8, 6, 1],
            // [7, 7, 2],
            // [8, 7, 0],
            // [9, 7, 1],
            // [8, 8, 2],
            // [9, 8, 0],
            // [10, 8, 1],
            // [9, 9, 2],
            [10, 9, 0],
            [11, 9, 1],
            [10, 10, 2],
            [11, 10, 0],
            [12, 10, 1],
            [11, 11, 2],
            [12, 11, 0],
            [13, 11, 1],
            [12, 12, 2],
            [13, 12, 0],
            [14, 12, 1],
            [13, 13, 2],
            [14, 13, 0],
            [15, 13, 1],
            [14, 14, 2],
            [15, 14, 0],
            [16, 14, 1],
            [15, 15, 2],
            [16, 15, 0],
            [17, 15, 1],
            [16, 16, 2],
            [17, 16, 0],
            [18, 16, 1],
            [17, 17, 2],
            [18, 17, 0],
            [19, 17, 1],
            [18, 18, 2],
            [19, 18, 0],
            [20, 18, 1],
            [19, 19, 2],
            [20, 19, 0],
            [21, 19, 1],
            [20, 20, 2],
            [21, 20, 0],
            [22, 20, 1],
            [21, 21, 2],
            // 护手：垂直于剑身，逆时针旋转 45°（窄）
            [23, 20, 3],
            [21, 22, 3],
            [20, 22, 3],
            [21, 21, 4],
            [22, 20, 3],
            [23, 19, 3],
            [22, 21, 4],
            // 剑柄：2 格宽错位斜线，深棕色（短）
            [22, 22, 5],
            [23, 22, 6],
            [23, 21, 5],
            [24, 23, 6],
            [25, 24, 6],
            [26, 25, 6],
        ],
    },
    qimei_staff: {
        gripX: 7,
        gripY: 7,
        grip2X: 24,
        grip2Y: 24,
        palette: {
            '0': '#9a6d33', // 棍身 亮
            '1': '#6e441a', // 棍身 暗
        },
        pixels: [
            // 齐眉棍：2 格宽 45° 斜棍，25 格长，在 32×32 网格内居中（3,3 → 27,27）。
            // 每行固定 2 像素（亮/暗两色做圆柱立体感）。
            // 主握点 7,7 锚定副手（左手/图中右侧），第二握点 24,24 定义棍身轴线（45°）。
            // 渲染时用图的旋转（graphics/canvas transform）绕副手旋转整根棍子，使棍身穿过两只手。
            [3, 3, 0],
            [4, 3, 1],
            [4, 4, 0],
            [5, 4, 1],
            [5, 5, 0],
            [6, 5, 1],
            [6, 6, 0],
            [7, 6, 1],
            [7, 7, 0],
            [8, 7, 1],
            [8, 8, 0],
            [9, 8, 1],
            [9, 9, 0],
            [10, 9, 1],
            [10, 10, 0],
            [11, 10, 1],
            [11, 11, 0],
            [12, 11, 1],
            [12, 12, 0],
            [13, 12, 1],
            [13, 13, 0],
            [14, 13, 1],
            [14, 14, 0],
            [15, 14, 1],
            [15, 15, 0],
            [16, 15, 1],
            [16, 16, 0],
            [17, 16, 1],
            [17, 17, 0],
            [18, 17, 1],
            [18, 18, 0],
            [19, 18, 1],
            [19, 19, 0],
            [20, 19, 1],
            [20, 20, 0],
            [21, 20, 1],
            [21, 21, 0],
            [22, 21, 1],
            [22, 22, 0],
            [23, 22, 1],
            [23, 23, 0],
            [24, 23, 1],
            [24, 24, 0],
            [25, 24, 1],
            [25, 25, 0],
            [26, 25, 1],
            [26, 26, 0],
            [27, 26, 1],
            [27, 27, 0],
            [28, 27, 1],
        ],
    },
}

/** 根据武器 ID 获取叠加层 */
export function getWeaponOverlay(weaponId: string): WeaponOverlay {
    return WEAPON_OVERLAYS[weaponId] ?? WEAPON_OVERLAYS.bare_hands
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

/**
 * 双手武器攻击姿势的手部视觉微调（格）：
 * 主握点锚定副手（图右），主手端升 1 格、副手端降 1 格，使棍身更贴合双手。
 */
const DUAL_ATTACK_ADJUST = { anchorDY: 0.5, targetDY: -1 }

/** 双手武器的有效锚点（握点=副手）与目标（另一只手=主手）位置 */
function getDualHandPoints(pose: string): { anchor: { x: number; y: number }; target: { x: number; y: number } } {
    const anchor = OTHER_HAND_POINT[pose] ?? OTHER_HAND_POINT.idle
    const target = HAND_POINTS[pose] ?? HAND_POINTS.idle
    if (pose !== 'attack') return { anchor, target }
    return {
        anchor: { x: anchor.x, y: anchor.y + DUAL_ATTACK_ADJUST.anchorDY },
        target: { x: target.x, y: target.y + DUAL_ATTACK_ADJUST.targetDY },
    }
}

/** 武器锚定手：单手武器锚定主手；双手武器锚定副手（左手，图中右侧） */
export function getWeaponHand(overlay: WeaponOverlay, pose: string): { x: number; y: number } {
    if (overlay.grip2X !== undefined && overlay.grip2Y !== undefined) {
        return getDualHandPoints(pose).anchor
    }
    return HAND_POINTS[pose] ?? HAND_POINTS.idle
}

/**
 * 计算武器在给定姿势/朝向上的旋转角度（弧度）。
 * - 单手武器（无 grip2）：idle=0，attack=±45°（按朝向倾斜），锚定主手。
 * - 双手武器（有 grip2）：主握点锚定副手（左手），旋转使棍身轴线穿过主手（右手），
 *   角度 = 副手→主手连线方向角 − 武器轴线（主握点→第二握点）方向角。
 *   朝左时人物与武器水平镜像，需用镜像后的方向重新计算。
 */
export function getWeaponAngle(overlay: WeaponOverlay, pose: string, facingRight: boolean): number {
    if (overlay.grip2X === undefined || overlay.grip2Y === undefined) {
        if (pose !== 'attack') return 0
        return facingRight ? -Math.PI / 4 : Math.PI / 4
    }
    const { anchor, target } = getDualHandPoints(pose) // 锚点 = 副手（左手），目标 = 主手（右手）
    const dx = target.x - anchor.x
    const dy = target.y - anchor.y
    const wdx = overlay.grip2X - overlay.gripX
    const wdy = overlay.grip2Y - overlay.gripY
    if (facingRight) return Math.atan2(dy, dx) - Math.atan2(wdy, wdx)
    // 朝左：武器本地 x 镜像为 -wdx，锚点/目标 x 亦镜像为 -dx
    return Math.atan2(dy, -dx) - Math.atan2(wdy, -wdx)
}

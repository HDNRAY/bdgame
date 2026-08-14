/** 武器叠加层 */

import type { WeaponOverlay, WeaponPoseConfig } from './types'
import { SPRITE_PAD_LEFT } from './constants'
/** 各姿势右手握柄位置（角色精灵坐标，网格尺寸见 constants.ts SPRITE_WIDTH×SPRITE_HEIGHT） */
export const HAND_POINTS: Record<string, { x: number; y: number }> = {
    idle: { x: 30 + SPRITE_PAD_LEFT, y: 32 },
    attack: { x: 16 + SPRITE_PAD_LEFT, y: 29 },
    dodge: { x: 32 + SPRITE_PAD_LEFT, y: 32 }, // 左移 1 格
    parry: { x: 28 + SPRITE_PAD_LEFT, y: 19 },
}

/**
 * 各姿势副手（左手，图中右侧）握点位置（角色精灵坐标，取 LEFT_HAND_COVER 中心）。
 * 双手武器的主握点（gripX/gripY）锚定于此；棍身轴线须穿过主手。
 */
export const OTHER_HAND_POINT: Record<string, { x: number; y: number }> = {
    idle: { x: 52.5, y: 31.5 },
    attack: { x: 42, y: 25.5 },
    dodge: { x: 54.5, y: 31.5 }, // 左移 1 格
    parry: { x: 45 + SPRITE_PAD_LEFT, y: 19 },
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
    dodge: [
        [32 + SPRITE_PAD_LEFT, 31],
        [33 + SPRITE_PAD_LEFT, 31],
        [32 + SPRITE_PAD_LEFT, 32],
        [33 + SPRITE_PAD_LEFT, 32],
    ],
    parry: [
        [28 + SPRITE_PAD_LEFT, 19],
        [29 + SPRITE_PAD_LEFT, 19],
        [28 + SPRITE_PAD_LEFT, 20],
        [29 + SPRITE_PAD_LEFT, 20],
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
    dodge: [
        [54, 31],
        [55, 31],
        [54, 32],
        [55, 32],
    ],
    parry: [
        [44 + SPRITE_PAD_LEFT, 19],
        [45 + SPRITE_PAD_LEFT, 19],
        [44 + SPRITE_PAD_LEFT, 20],
        [45 + SPRITE_PAD_LEFT, 20],
    ],
}

export const WEAPON_OVERLAYS: Record<string, WeaponOverlay> = {
    bare_hands: { pixels: [] },
    fist: {
        pixels: [
            [8, 0, '#ffd700'],
            [9, 0, '#ffd700'],
        ],
    },
    sword: {
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
        pixels: [
            // 上珠（白）— 偏白渐变，高光→底色→阴影
            [15, 4, '#f2f2f2'],
            [16, 4, '#dfdfdf'],
            [14, 5, '#f2f2f2'],
            [15, 5, '#dfdfdf'],
            [16, 5, '#dfdfdf'],
            [17, 5, '#c2c2c2'],
            [14, 6, '#dfdfdf'],
            [15, 6, '#dfdfdf'],
            [16, 6, '#dfdfdf'],
            [17, 6, '#c2c2c2'],
            [15, 7, '#dfdfdf'],
            [16, 7, '#c2c2c2'],
            // 左下珠（灰）— 中灰渐变
            [5, 22, '#d4d4d4'],
            [6, 22, '#a3a3a3'],
            [4, 23, '#d4d4d4'],
            [5, 23, '#a3a3a3'],
            [6, 23, '#a3a3a3'],
            [7, 23, '#6f6f6f'],
            [4, 24, '#a3a3a3'],
            [5, 24, '#a3a3a3'],
            [6, 24, '#a3a3a3'],
            [7, 24, '#6f6f6f'],
            [5, 25, '#a3a3a3'],
            [6, 25, '#6f6f6f'],
            // 右下珠（黑）— 偏黑渐变
            [25, 22, '#7a7a7a'],
            [26, 22, '#4d4d4d'],
            [24, 23, '#7a7a7a'],
            [25, 23, '#4d4d4d'],
            [26, 23, '#4d4d4d'],
            [27, 23, '#262626'],
            [24, 24, '#4d4d4d'],
            [25, 24, '#4d4d4d'],
            [26, 24, '#4d4d4d'],
            [27, 24, '#262626'],
            [25, 25, '#4d4d4d'],
            [26, 25, '#262626'],
        ],
    },
    xiu_dong: {
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
        pixels: [
            [7, -2, '#d8d8d8'],
            [8, -1, '#d8d8d8'],
            [9, 0, '#d8d8d8'],
            [10, 1, '#d8d8d8'],
            [8, -3, '#996633'],
        ],
    },
    iron_spear: {
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

/** 全部姿势名 */
export const POSE_NAMES = ['idle', 'attack', 'dodge', 'parry', 'hit'] as const

/** 生成所有姿势同一握持配置的便捷函数 — 特定姿势需单独调整时再覆盖该 key */
function makePoses(base: WeaponPoseConfig): Record<string, WeaponPoseConfig> {
    const out: Record<string, WeaponPoseConfig> = {}
    for (const p of POSE_NAMES) out[p] = { ...base }
    return out
}

/** 每武器·每姿势握持配置 — 独立于武器美术。未覆盖字段回落全局 HAND_POINTS / 自动角度规则 */
export const WEAPON_POSES: Record<string, Record<string, WeaponPoseConfig>> = {
    bare_hands: makePoses({ gripX: 0, gripY: 0 }),
    fist: makePoses({ gripX: 8, gripY: 0 }),
    sword: makePoses({ gripX: 8, gripY: 7 }),
    spear: makePoses({ gripX: 10, gripY: 6 }),
    zantetsu: makePoses({ gripX: 9, gripY: 7 }),
    ciyuan_blade: makePoses({ gripX: 8, gripY: 7 }),
    overlord_blade: makePoses({ gripX: 9, gripY: 7 }),
    tri_orb: {
        ...makePoses({ gripX: 9, gripY: 22, noHandCover: true }),
        idle: { gripX: 9, gripY: 22, noHandCover: true, angle: (-37 * Math.PI) / 180 }, // 逆时针 37°
        attack: {
            gripX: 9,
            gripY: 22,
            noHandCover: true,
            handX: 20, // 锚点左挪 20（HAND_POINTS.attack x=28）
            handY: 32,
            angle: (-80 * Math.PI) / 180, // 逆时针 45°
        },
        dodge: {
            gripX: 9,
            gripY: 22,
            noHandCover: true,
            handX: 40, // 锚点左挪 4（HAND_POINTS.dodge x=44），随整体再左移 1
            handY: 32,
            angle: (-37 * Math.PI) / 180, // 与 idle 一致
        },
        hit: { gripX: 9, gripY: 22, noHandCover: true, angle: (-37 * Math.PI) / 180 }, // 与 idle 一致
    },
    xiu_dong: makePoses({ gripX: 8, gripY: 7 }),
    chun_lei: makePoses({ gripX: 8, gripY: 7 }),
    heshan_sword: makePoses({ gripX: 8, gripY: 7 }),
    dagger: makePoses({ gripX: 8, gripY: -3 }),
    iron_spear: makePoses({ gripX: 10, gripY: -3 }),
    peach_sword: makePoses({ gripX: 24, gripY: 24 }),
    qimei_staff: makePoses({ gripX: 7, gripY: 7, grip2X: 24, grip2Y: 24 }),
}

/** 未登记武器的兜底配置 */
const DEFAULT_POSE: WeaponPoseConfig = { gripX: 0, gripY: 0 }

/** 获取武器在某姿势的握持配置（该姿势未定义时回落 idle；武器未登记时兜底 grip 0,0） */
export function getWeaponPoseConfig(weaponId: string, pose: string): WeaponPoseConfig {
    const set = WEAPON_POSES[weaponId]
    return set?.[pose] ?? set?.idle ?? DEFAULT_POSE
}

/** 根据武器 ID 获取叠加层（纯美术） */
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

/**
 * 武器锚定手位置：
 * - 姿势配置显式给了 handX/handY → 直接用
 * - 否则按 anchorHand（默认：单手=主手，双手=副手）查全局手部表
 */
export function getWeaponHand(weaponId: string, pose: string): { x: number; y: number } {
    const cfg = getWeaponPoseConfig(weaponId, pose)
    if (cfg.handX !== undefined && cfg.handY !== undefined) {
        return { x: cfg.handX, y: cfg.handY }
    }
    const dual = cfg.grip2X !== undefined && cfg.grip2Y !== undefined
    const useOff = cfg.anchorHand === 'off' || (cfg.anchorHand === undefined && dual)
    if (useOff) return getDualHandPoints(pose).anchor
    return HAND_POINTS[pose] ?? HAND_POINTS.idle
}

/**
 * 计算武器在给定姿势/朝向上的旋转角度（弧度）。
 * - 姿势配置显式给了 angle → 直接用（朝左取负镜像）
 * - 单手武器（无 grip2）：idle=0，attack=±45°（按朝向倾斜），锚定主手。
 * - 双手武器（有 grip2）：主握点锚定副手（左手），旋转使棍身轴线穿过主手（右手），
 *   角度 = 副手→主手连线方向角 − 武器轴线（主握点→第二握点）方向角。
 *   朝左时人物与武器水平镜像，需用镜像后的方向重新计算。
 */
export function getWeaponAngle(weaponId: string, pose: string, facingRight: boolean): number {
    const cfg = getWeaponPoseConfig(weaponId, pose)
    if (cfg.angle !== undefined) {
        return facingRight ? cfg.angle : -cfg.angle
    }
    if (cfg.grip2X === undefined || cfg.grip2Y === undefined) {
        if (pose !== 'attack') return 0
        return facingRight ? -Math.PI / 4 : Math.PI / 4
    }
    const { anchor, target } = getDualHandPoints(pose) // 锚点 = 副手（左手），目标 = 主手（右手）
    const dx = target.x - anchor.x
    const dy = target.y - anchor.y
    const wdx = cfg.grip2X - cfg.gripX
    const wdy = cfg.grip2Y - cfg.gripY
    if (facingRight) return Math.atan2(dy, dx) - Math.atan2(wdy, wdx)
    // 朝左：武器本地 x 镜像为 -wdx，锚点/目标 x 亦镜像为 -dx
    return Math.atan2(dy, -dx) - Math.atan2(wdy, -wdx)
}

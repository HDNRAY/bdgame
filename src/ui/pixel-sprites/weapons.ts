/** 武器叠加层 */

import type { WeaponOverlay, WeaponPoseConfig } from './types'
import { SPRITE_PAD_LEFT } from './constants'
/** 各姿势右手握柄位置（角色精灵坐标，网格尺寸见 constants.ts SPRITE_WIDTH×SPRITE_HEIGHT） */
export const HAND_POINTS: Record<string, { x: number; y: number }> = {
    idle: { x: 30 + SPRITE_PAD_LEFT, y: 32 },
    attack: { x: 17.5 + SPRITE_PAD_LEFT, y: 27.5 }, // attack 帧主手（武器整体下移 1 格）
    dodge: { x: 32 + SPRITE_PAD_LEFT, y: 32 }, // 左移 1 格
    hit: { x: 23.5 + SPRITE_PAD_LEFT, y: 34.5 }, // 受击：武器被打飞（左 10 后再右移 2、下 3）
    // 招架：主手（右手）在面前抬起握拳（DEFAULT_PARRY 皮肤像素 28-29,24-25 中心）
    parry: { x: 28.5 + SPRITE_PAD_LEFT, y: 24.5 },
}

/**
 * 各姿势副手（左手，图中右侧）握点位置（角色精灵坐标，取 LEFT_HAND_COVER 中心）。
 * 双手武器的主握点（gripX/gripY）锚定于此；棍身轴线须穿过主手。
 * 一律以「内容坐标 + SPRITE_PAD_LEFT」书写，便于整体平移角色。
 */
export const OTHER_HAND_POINT: Record<string, { x: number; y: number }> = {
    idle: { x: 39.5 + SPRITE_PAD_LEFT, y: 32 }, // 副手武器左移 1 格、下移半格（与主手同高）
    attack: { x: 30 + SPRITE_PAD_LEFT, y: 26.5 }, // attack 帧副手（武器整体下移 1 格）
    dodge: { x: 41.5 + SPRITE_PAD_LEFT, y: 32 }, // 左移 1 格（武器）、与主手同高
    hit: { x: 43.5 + SPRITE_PAD_LEFT, y: 34.5 }, // 受击：副手武器右移 2、下移 3 格
    // 招架：副手（左手）在腰间握持（下移 1 格）
    parry: { x: 40 + SPRITE_PAD_LEFT, y: 28.5 },
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
        [17 + SPRITE_PAD_LEFT, 26],
        [18 + SPRITE_PAD_LEFT, 26],
        [17 + SPRITE_PAD_LEFT, 27],
        [18 + SPRITE_PAD_LEFT, 27],
    ],
    dodge: [
        [32 + SPRITE_PAD_LEFT, 31],
        [33 + SPRITE_PAD_LEFT, 31],
        [32 + SPRITE_PAD_LEFT, 32],
        [33 + SPRITE_PAD_LEFT, 32],
    ],
    parry: [
        // 主手：面前抬起握拳（DEFAULT_PARRY 皮肤像素 28-29,24-25）
        [28 + SPRITE_PAD_LEFT, 24],
        [29 + SPRITE_PAD_LEFT, 24],
        [28 + SPRITE_PAD_LEFT, 25],
        [29 + SPRITE_PAD_LEFT, 25],
    ],
}

/**
 * 各姿势第二只手（左手）覆盖像素（人物精灵坐标）— 双手武器（有 grip2）用皮肤色盖住第二握点。
 * idle 左手在角色右侧 4 格：40,31 41,31 40,32 41,32（+SPRITE_PAD_LEFT）；attack：29-31,25-26。
 * 一律以「内容坐标 + SPRITE_PAD_LEFT」书写，便于整体平移角色。
 */
export const LEFT_HAND_COVER: Record<string, [number, number][]> = {
    idle: [
        [40 + SPRITE_PAD_LEFT, 31],
        [41 + SPRITE_PAD_LEFT, 31],
        [40 + SPRITE_PAD_LEFT, 32],
        [41 + SPRITE_PAD_LEFT, 32],
    ],
    attack: [
        [29 + SPRITE_PAD_LEFT, 26],
        [29 + SPRITE_PAD_LEFT, 25],
        [30 + SPRITE_PAD_LEFT, 25],
        [30 + SPRITE_PAD_LEFT, 26],
    ],
    dodge: [
        [42 + SPRITE_PAD_LEFT, 31],
        [43 + SPRITE_PAD_LEFT, 31],
        [42 + SPRITE_PAD_LEFT, 32],
        [43 + SPRITE_PAD_LEFT, 32],
    ],
    parry: [
        // 副手：腰间握持（DEFAULT_PARRY 皮肤像素 39-41,27 / 40-41,28）
        [39 + SPRITE_PAD_LEFT, 27],
        [40 + SPRITE_PAD_LEFT, 27],
        [41 + SPRITE_PAD_LEFT, 27],
        [40 + SPRITE_PAD_LEFT, 28],
        [41 + SPRITE_PAD_LEFT, 28],
    ],
}

export const WEAPON_OVERLAYS: Record<string, WeaponOverlay> = {
    bare_hands: { pixels: [] },
    dark_iron_sword: {
        palette: {
            '0': '#3c3c46', // 剑身（中）
            '1': '#26262e', // 剑身暗侧
            '2': '#5a5a68', // 剑身亮侧
            '3': '#1f1f27', // 护手（最深，略提亮）
            '5': '#4a2f1c', // 剑柄缠绳
            '7': '#2f2f38', // 柄端配重
        },
        pixels: [
            // 玄铁重剑：通体玄铁；护手最深色；柄在右下、剑身朝左上
            // 主握点 21,21（柄）、第二握点 18,18（护手端）
            [4, 4, 0],
            [5, 4, 0],
            [6, 4, 2],
            [7, 4, 2],
            [4, 5, 0],
            [5, 5, 0],
            [6, 5, 0],
            [7, 5, 2],
            [8, 5, 2],
            [4, 6, 1],
            [5, 6, 0],
            [6, 6, 0],
            [7, 6, 0],
            [8, 6, 2],
            [9, 6, 2],
            [4, 7, 1],
            [5, 7, 1],
            [6, 7, 0],
            [7, 7, 0],
            [8, 7, 0],
            [9, 7, 2],
            [10, 7, 2],
            [5, 8, 1],
            [6, 8, 1],
            [7, 8, 0],
            [8, 8, 0],
            [9, 8, 0],
            [10, 8, 2],
            [11, 8, 2],
            [6, 9, 1],
            [7, 9, 1],
            [8, 9, 0],
            [9, 9, 0],
            [10, 9, 0],
            [11, 9, 2],
            [12, 9, 2],
            [7, 10, 1],
            [8, 10, 1],
            [9, 10, 0],
            [10, 10, 0],
            [11, 10, 0],
            [12, 10, 2],
            [13, 10, 2],
            [8, 11, 1],
            [9, 11, 1],
            [10, 11, 0],
            [11, 11, 0],
            [12, 11, 0],
            [13, 11, 2],
            [14, 11, 2],
            [9, 12, 1],
            [10, 12, 1],
            [11, 12, 0],
            [12, 12, 0],
            [13, 12, 0],
            [14, 12, 2],
            [15, 12, 2],
            [10, 13, 1],
            [11, 13, 1],
            [12, 13, 0],
            [13, 13, 0],
            [14, 13, 0],
            [15, 13, 2],
            [16, 13, 2],
            [11, 14, 1],
            [12, 14, 1],
            [13, 14, 0],
            [14, 14, 0],
            [15, 14, 0],
            [16, 14, 2],
            [17, 14, 2],
            [12, 15, 1],
            [13, 15, 1],
            [14, 15, 0],
            [15, 15, 0],
            [16, 15, 0],
            [17, 15, 2],
            [18, 15, 2],
            [13, 16, 1],
            [14, 16, 1],
            [15, 16, 0],
            [16, 16, 0],
            [17, 16, 0],
            [18, 16, 2],
            [19, 16, 2],
            [14, 17, 1],
            [15, 17, 1],
            [16, 17, 0],
            [17, 17, 0],
            [18, 17, 0],
            [19, 17, 2],
            [20, 17, 2],
            [15, 18, 1],
            [16, 18, 1],
            [17, 18, 0],
            [18, 18, 0],
            [19, 18, 0],
            [20, 18, 2],
            [21, 18, 2],
            [24, 18, 3],
            [16, 19, 1],
            [17, 19, 1],
            [18, 19, 0],
            [19, 19, 0],
            [20, 19, 0],
            [21, 19, 2],
            [22, 19, 2],
            [23, 19, 3],
            [24, 19, 3],
            [17, 20, 1],
            [18, 20, 1],
            [19, 20, 0],
            [20, 20, 0],
            [21, 20, 0],
            [22, 20, 3],
            [23, 20, 3],
            [24, 20, 3],
            [18, 21, 1],
            [19, 21, 1],
            [20, 21, 0],
            [21, 21, 3],
            [22, 21, 3],
            [23, 21, 3],
            [24, 21, 3],
            [19, 22, 1],
            [20, 22, 3],
            [21, 22, 3],
            [22, 22, 3],
            [23, 22, 3],
            [19, 23, 3],
            [20, 23, 3],
            [21, 23, 3],
            [22, 23, 3],
            [23, 23, 5],
            [24, 23, 5],
            [18, 24, 3],
            [19, 24, 3],
            [20, 24, 3],
            [21, 24, 3],
            [23, 24, 5],
            [24, 24, 5],
            [25, 24, 5],
            [24, 25, 5],
            [25, 25, 5],
            [26, 25, 5],
            [25, 26, 5],
            [26, 26, 5],
            [27, 26, 7],
            [28, 26, 7],
            [26, 27, 7],
            [27, 27, 7],
            [26, 28, 7],
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
    // 破狼竹枝（长杆·双手）：2 格宽竹杖，5 道竹节环；梢部偏嫩、根部偏深
    // 轴线与齐眉棍同在一条 45° 对角线上（u = (6 - x - y) · √½）：
    // 主握点 7,7 锚定副手，第二握点 24,24 定义轴线（45°）
    po_lang_zhu_zhi: {
        palette: {
            '0': '#a7b562', // 竹身（中）
            '1': '#74833f', // 竹身暗侧
            '2': '#cbd68f', // 梢部嫩竹
            '3': '#5a6733', // 竹节暗
            '4': '#8e9c52', // 竹节亮
            '5': '#4a552a', // 根部
        },
        pixels: [
            [3, 3, 2],
            [4, 3, 4],
            [4, 4, 2],
            [5, 4, 4],
            [5, 5, 0],
            [6, 5, 1],
            [6, 6, 0],
            [7, 6, 1],
            [7, 7, 4],
            [8, 7, 3],
            [8, 8, 0],
            [9, 8, 1],
            [9, 9, 0],
            [10, 9, 1],
            [10, 10, 0],
            [11, 10, 1],
            [11, 11, 0],
            [12, 11, 3],
            [12, 12, 0],
            [13, 12, 1],
            [13, 13, 0],
            [14, 13, 1],
            [14, 14, 0],
            [15, 14, 1],
            [15, 15, 0],
            [16, 15, 3],
            [16, 16, 4],
            [17, 16, 1],
            [17, 17, 0],
            [18, 17, 1],
            [18, 18, 0],
            [19, 18, 1],
            [19, 19, 0],
            [20, 19, 1],
            [20, 20, 4],
            [21, 20, 1],
            [21, 21, 0],
            [22, 21, 1],
            [22, 22, 0],
            [23, 22, 1],
            [23, 23, 0],
            [24, 23, 1],
            [24, 24, 4],
            [25, 24, 3],
            [25, 25, 0],
            [26, 25, 5],
            [26, 26, 1],
            [27, 26, 5],
            [27, 27, 1],
        ],
    },
    // 陨铁神珍（长杆·双手）：3 格宽等粗铁柱，两端金箍，柱身陨铁星点
    dinghai_shen_tie: {
        palette: {
            '0': '#525a68', // 柱身（中）
            '1': '#343a45', // 柱身暗侧
            '2': '#7b8290', // 柱身亮侧
            '4': '#c9973a', // 金箍（中）
            '5': '#8a6522', // 金箍暗
            '6': '#e8c065', // 金箍亮
            '7': '#a8b0bd', // 陨铁星点
        },
        pixels: [
            [4, 4, 0],
            [5, 4, 5],
            [4, 5, 6],
            [5, 5, 4],
            [6, 5, 5],
            [5, 6, 6],
            [6, 6, 7],
            [7, 6, 1],
            [6, 7, 2],
            [7, 7, 0],
            [8, 7, 1],
            [7, 8, 2],
            [8, 8, 0],
            [9, 8, 1],
            [8, 9, 2],
            [9, 9, 0],
            [10, 9, 1],
            [9, 10, 2],
            [10, 10, 0],
            [11, 10, 1],
            [10, 11, 2],
            [11, 11, 0],
            [12, 11, 1],
            [11, 12, 2],
            [12, 12, 0],
            [13, 12, 1],
            [12, 13, 2],
            [13, 13, 0],
            [14, 13, 1],
            [13, 14, 2],
            [14, 14, 0],
            [15, 14, 1],
            [14, 15, 2],
            [15, 15, 0],
            [16, 15, 1],
            [15, 16, 2],
            [16, 16, 0],
            [17, 16, 1],
            [16, 17, 2],
            [17, 17, 7],
            [18, 17, 1],
            [17, 18, 2],
            [18, 18, 0],
            [19, 18, 1],
            [18, 19, 2],
            [19, 19, 0],
            [20, 19, 1],
            [19, 20, 2],
            [20, 20, 7],
            [21, 20, 1],
            [20, 21, 2],
            [21, 21, 0],
            [22, 21, 1],
            [21, 22, 2],
            [22, 22, 0],
            [23, 22, 1],
            [22, 23, 2],
            [23, 23, 0],
            [24, 23, 1],
            [23, 24, 2],
            [24, 24, 0],
            [25, 24, 1],
            [24, 25, 2],
            [25, 25, 4],
            [26, 25, 5],
            [25, 26, 6],
            [26, 26, 0],
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
    // 每个武器独立设定（哪怕同类型也不共享），便于逐武器微调 grip/角度/锚定手
    bare_hands: makePoses({ gripX: 0, gripY: 0 }),
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
            handX: 16.5, // 锚点左挪 8（HAND_POINTS.attack.x = 24.5）
            handY: 32,
            angle: (-80 * Math.PI) / 180, // 逆时针 45°
        },
        dodge: {
            gripX: 9,
            gripY: 22,
            noHandCover: true,
            handX: 35, // 锚点左挪 4（HAND_POINTS.dodge.x = 39）
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
    // 桃木剑：单手剑。招架时主手锚定（面前抬手），剑身旋转斜穿副手（腰间握持），只给主手遮罩
    peach_sword: {
        ...makePoses({ gripX: 24, gripY: 24 }),
        parry: { gripX: 24, gripY: 24, angle: 2.6857 }, // 剑尖朝右下斜下（穿过副手）
        // hit：整体上移 5 格（锚点跟手上移）→ 再以柄为轴顺时针 15°
        hit: {
            gripX: 24,
            gripY: 24,
            handX: HAND_POINTS.hit.x,
            handY: HAND_POINTS.hit.y - 5,
            angle: (15 * Math.PI) / 180,
        },
    },
    // 齐眉棍（双手）：attack 副手锚点上移 1 格；parry 武器整体右移 4 格
    // （右移 = 武器本地握点左移 4；两点连线角度自动计算，故双锚点仍落在手上）
    qimei_staff: {
        ...makePoses({ gripX: 7, gripY: 7, grip2X: 24, grip2Y: 24 }),
        // attack：副手锚点上移 1 格；主手锚点（第二握点）上移 1 格（两点各自覆盖，连线角度自动贴合）
        attack: {
            gripX: 7,
            gripY: 7,
            grip2X: 24,
            grip2Y: 24,
            handX: OTHER_HAND_POINT.attack.x,
            handY: OTHER_HAND_POINT.attack.y - 0.5, // 有效锚点含 +0.5 微调 → 净上移 1 格
            targetX: HAND_POINTS.attack.x,
            targetY: HAND_POINTS.attack.y - 1, // 主手上移 1 格
        },
        // parry：副手锚点上移 1 格；武器整体「水平右移 5 格 + 下移 1.5 格」且两点仍贴手
        // 手法：两个握点在武器图上一起平移（按当前旋转角逆向量补偿）→ 武器整体平移，握点↔手不变。
        // 注：补偿量随 parry 手锚点/棍身轴线变化，改手位后需重算。
        parry: {
            gripX: 10.55,
            gripY: 10.82,
            grip2X: 27.55,
            grip2Y: 27.82,
            handX: OTHER_HAND_POINT.parry.x,
            handY: OTHER_HAND_POINT.parry.y - 1,
            targetX: HAND_POINTS.parry.x,
            targetY: HAND_POINTS.parry.y,
        },
        // hit：脱手落在角色左侧、竖着；整体右移 12 格并顺时针 10°
        hit: {
            gripX: 7,
            gripY: 7,
            grip2X: 24,
            grip2Y: 24,
            handX: 24 + SPRITE_PAD_LEFT, // 12 + 12（右移 12 格）
            handY: 34.5,
            angle: (-3 * Math.PI) / 4 + (10 * Math.PI) / 180, // 长端朝上竖直 → 顺时针 10°
        },
    },
    // 玄铁重剑：虽为重型（heavy），但按**主手单持**处理 —— 只锚主手、无第二握点
    // 握点在剑柄中心 25,25（不是护手处）
    dark_iron_sword: {
        ...makePoses({ gripX: 25, gripY: 25 }),
        // parry：借「单持桃木剑」的角度（153.9°）→ 剑尖朝右下斜下、扫过身前
        parry: { gripX: 25, gripY: 25, angle: 2.6857 },
        // hit：整体上移 5 格（锚点跟手上移）→ 再以柄为轴顺时针 15°
        hit: {
            gripX: 25,
            gripY: 25,
            handX: HAND_POINTS.hit.x,
            handY: HAND_POINTS.hit.y - 5,
            angle: (15 * Math.PI) / 180,
        },
    },
    // 破狼竹枝 / 陨铁神珍（双手长杆）：握点同齐眉棍 —— 主握点 7,7 锚副手、第二握点 24,24 定轴线
    // hit：照齐眉棍的脱手姿势 —— 武器竖着落在角色左侧、顺时针 10°（握点与两锚点显式给出）
    po_lang_zhu_zhi: {
        ...makePoses({ gripX: 7, gripY: 7, grip2X: 24, grip2Y: 24 }),
        hit: {
            gripX: 7,
            gripY: 7,
            grip2X: 24,
            grip2Y: 24,
            handX: 24 + SPRITE_PAD_LEFT, // 右移 12 格
            handY: 34.5,
            angle: (-3 * Math.PI) / 4 + (10 * Math.PI) / 180, // 长端朝上竖直 → 顺时针 10°
        },
    },
    dinghai_shen_tie: {
        ...makePoses({ gripX: 7, gripY: 7, grip2X: 24, grip2Y: 24 }),
        hit: {
            gripX: 7,
            gripY: 7,
            grip2X: 24,
            grip2Y: 24,
            handX: 24 + SPRITE_PAD_LEFT, // 右移 12 格
            handY: 34.5,
            angle: (-3 * Math.PI) / 4 + (10 * Math.PI) / 180, // 长端朝上竖直 → 顺时针 10°
        },
    },
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
 * 双持（主手 + 副手各一把单手武器）的角度规则。
 * 机制上一次只出一招：主手挥击、副手保持握持待机 —— 副手取「同向轻前倾」，
 * 招架（parry）时两把武器在身前交叉（数值为初值，可在像素查看器里看后微调）。
 */
export const DUAL_MAIN_ANGLE: Record<string, number> = {
    // 招架：主手向前上方，与副手交叉
    parry: (100 * Math.PI) / 180,
    // 受击：主手武器被打飞时的朝向（0 = 保持原角度）
    hit: (20 * Math.PI) / 180,
}

export const DUAL_OFFHAND_ANGLE: Record<string, number> = {
    idle: 0,
    // 攻击：副手同向轻前倾（-12°），比待机更"备战"但不与主手抢戏
    attack: (-12 * Math.PI) / 180,
    dodge: 0,
    hit: (58 * Math.PI) / 180,
    move: 0,
    // 招架：副手向前下方，与主手交叉
    parry: (-10 * Math.PI) / 180,
}

/** 双持时主手角度（未覆盖的姿势沿用单手规则） */
export function getDualMainAngle(weaponId: string, pose: string, facingRight: boolean): number {
    const override = DUAL_MAIN_ANGLE[pose]
    if (override !== undefined) return facingRight ? override : -override
    return getWeaponAngle(weaponId, pose, facingRight)
}

/** 双持时副手角度（锚定副手 OTHER_HAND_POINT） */
export function getDualOffhandAngle(pose: string, facingRight: boolean): number {
    const a = DUAL_OFFHAND_ANGLE[pose] ?? 0
    return facingRight ? a : -a
}

/**
 * 说明：受击（hit）时武器的"脱手"位置不再走全局位移叠加，
 * 而是直接由各武器的 hit 锚点（HAND_POINTS.hit / OTHER_HAND_POINT.hit）
 * 与该武器的 WEAPON_POSES[weaponId].hit（handX/handY/angle）决定。
 */

/** 是否绘制手部覆盖：hit 时武器脱手，不再画"握着"的皮肤盖片 */
export function shouldDrawHandCover(pose: string): boolean {
    return pose !== 'hit'
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
    // 锚点 = 副手（左手），目标 = 主手（右手）；两者均可被该武器的姿势配置覆盖
    const { anchor: baseAnchor, target: baseTarget } = getDualHandPoints(pose)
    const anchor = cfg.handX !== undefined && cfg.handY !== undefined ? { x: cfg.handX, y: cfg.handY } : baseAnchor
    const target =
        cfg.targetX !== undefined && cfg.targetY !== undefined ? { x: cfg.targetX, y: cfg.targetY } : baseTarget
    const dx = target.x - anchor.x
    const dy = target.y - anchor.y
    const wdx = cfg.grip2X - cfg.gripX
    const wdy = cfg.grip2Y - cfg.gripY
    if (facingRight) return Math.atan2(dy, dx) - Math.atan2(wdy, wdx)
    // 朝左：武器本地 x 镜像为 -wdx，锚点/目标 x 亦镜像为 -dx
    return Math.atan2(dy, -dx) - Math.atan2(wdy, -wdx)
}

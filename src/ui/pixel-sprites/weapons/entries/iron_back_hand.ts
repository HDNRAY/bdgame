/**
 * 武器「iron_back_hand」（素手无相）：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），甲片外缘/指节朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

/**
 * 素手无相：一枚古朴的白玉环，以炁驱动时延展覆盖手与小臂，化作银白护甲。
 *
 * 目前只出两张图：
 * - **通用图（overlay）= 白玉环** —— 武器本体（未驱动状态），六姿势缺图时的最后一层兜底；
 * - **idle = 延展态银白护甲** —— 小臂甲 + 护腕（带炁光）+ 拳甲，覆盖手与小臂。
 *
 * 其余五个姿势暂不单独出图，渲染时按 `getWeaponArt` 的坍缩链（art[姿势] → art.idle → overlay）
 * 落到 idle，即延展态。拳心 2×2（美术格 16-17 × 16-17）会被手部遮罩盖成皮肤色，
 * 正好在拳甲中间留出握紧的那只手；hit 姿势不画握持手，拳甲完整露出。
 */
// 这把武器**所有图共用**的调色板（下标 = 这里的键）：块里只写 `palette: PALETTE`，别再内联一份
// weapons/entries/iron_back_hand.ts 顶部：这把武器**所有图共用**的调色板（下标 = 这里的键）
const PALETTE: Record<string, string> = {
    '2': '#ffffff',
    '3': '#9fb5ae',
}

export const iron_back_hand: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = {
    // weapons/entries/iron_back_hand.ts → overlay:
    // weapons/entries/iron_back_hand.ts → 替换 overlay 那一条（其余不动）
    overlay: {
        palette: PALETTE,
        pixels: [
            [17, 11, 3],
            [18, 11, 3],
            [16, 12, 3],
            [19, 12, 3],
            [16, 13, 3],
            [19, 13, 3],
            [17, 14, 3],
            [18, 14, 3],
            [11, 16, 3],
            [12, 16, 3],
            [10, 17, 3],
            [13, 17, 3],
            [10, 18, 3],
            [13, 18, 3],
            [11, 19, 3],
            [12, 19, 3],
        ],
    },
    // weapons/entries/iron_back_hand.ts → art:
    // idle：一条贴着小臂的银白护甲带（x15-19，y10-18）—— 肘口收窄 3 格，
    // 护腕与拳甲各有一道叠边亮线（y12 / y15），护腕中间一道炁光（y14）。
    // 左缘受光 3、右缘背光 6、外轮廓 4；中段两格由手部遮罩盖成皮肤色，正好留出握紧的手。
    // weapons/entries/iron_back_hand.ts → art:
    // weapons/entries/iron_back_hand.ts → art:
    art: {
        idle: {
            pixels: [
                [10, 14, 2],
                [11, 14, 2],
                [20, 14, 2],
                [21, 14, 2],
                [10, 15, 2],
                [11, 15, 2],
                [20, 15, 2],
                [21, 15, 2],
            ],
        },
        // weapons/entries/iron_back_hand.ts → 放进 art: { … } 里替换 attack 那一条（其余姿势不动）
        attack: {
            pixels: [
                [21, 14, 2],
                [22, 14, 2],
                [9, 15, 2],
                [10, 15, 2],
                [21, 15, 2],
                [22, 15, 2],
                [9, 16, 2],
                [10, 16, 2],
            ],
        },
        // weapons/entries/iron_back_hand.ts → 放进 art: { … } 里替换 parry 那一条（其余姿势不动）
        parry: {
            pixels: [
                [10, 14, 2],
                [11, 14, 2],
                [10, 15, 2],
                [11, 15, 2],
                [21, 17, 2],
                [22, 17, 2],
                [23, 17, 2],
                [22, 18, 2],
                [23, 18, 2],
            ],
        },
        // weapons/entries/iron_back_hand.ts → 放进 art: { … } 里替换 buff 那一条（其余姿势不动）
        buff: {
            pixels: [
                [10, 14, 2],
                [11, 14, 2],
                [25, 14, 2],
                [26, 14, 2],
                [10, 15, 2],
                [11, 15, 2],
                [25, 15, 2],
                [26, 15, 2],
            ],
        },
    },
    // weapons/entries/iron_back_hand.ts → poses:
    poses: {
        ...makePoses({ gripX: 10.5, gripY: 14.5, handCover: false }),
        idle: { angle: 0 },
        attack: { gripDX: -1, gripDY: 1, angle: 0 },
        dodge: { angle: 0 },
        parry: { angle: 0 },
        hit: { angle: 0, handDX: 8, handDY: -3 },
        buff: { angle: 0 },
    },
}

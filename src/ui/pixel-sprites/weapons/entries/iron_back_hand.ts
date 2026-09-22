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
 * 两张图都只给 `pixels`，共用下面这一份 PALETTE（下标就是这里的键，全武器一套号）：
 * - **通用图（overlay）= 白玉环** —— 武器本体（未驱动状态）。两枚小环（左上、右下各一枚），
 *   用整套色阶（1~4），读起来是"亮玉"；
 * - **姿势图 = 银白护甲** —— 同一色系、比通用**深一档**（2~4），两端甲片；非通用时甲片直接盖住手
 *   （`handCover: false` 写在 poses 基底里），所以不再画手部皮肤遮罩。
 *
 * 深浅的口径：每块甲片/每枚环在自己的团块内按 `x + y` 排名 —— 越靠左上越受光（1 最亮、4 最暗），
 * 和全仓"刃/甲片外缘朝左上端"的受光约定一致。所以同色系里也有明确的光向，不靠描边也立得住。
 */
const PALETTE: Record<string, string> = {
    '1': '#ffffff', // 高光（纯白，最亮）
    '2': '#edf7f5', // 亮面（冷白，一点点玉调）
    '3': '#d5e6e3', // 中间调（浅玉）
    '4': '#b3c9c6', // 暗面（银玉灰 —— 整体提亮，不再是深绿）
}

export const iron_back_hand: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = {
    // weapons/entries/iron_back_hand.ts → overlay:
    // 白玉环：两枚小环。共用调色板挂在下面这一条上（整条替换时别把 palette 弄丢）。
    overlay: {
        palette: PALETTE,
        pixels: [
            [17, 11, 1],
            [18, 11, 2],
            [16, 12, 1],
            [19, 12, 3],
            [16, 13, 2],
            [19, 13, 4],
            [17, 14, 3],
            [18, 14, 4],
            [11, 16, 1],
            [12, 16, 2],
            [10, 17, 1],
            [13, 17, 3],
            [10, 18, 2],
            [13, 18, 4],
            [11, 19, 3],
            [12, 19, 4],
        ],
    },
    // weapons/entries/iron_back_hand.ts → art:
    // 姿势甲片：同一色系、比通用深一档（2~5）；每块仍是"左上受光、右下背光"。
    art: {
        idle: {
            pixels: [
                [10, 14, 2],
                [11, 14, 3],
                [20, 14, 2],
                [21, 14, 3],
                [10, 15, 3],
                [11, 15, 4],
                [20, 15, 3],
                [21, 15, 4],
            ],
        },
        attack: {
            pixels: [
                [21, 14, 2],
                [22, 14, 3],
                [9, 15, 2],
                [10, 15, 3],
                [21, 15, 3],
                [22, 15, 4],
                [9, 16, 3],
                [10, 16, 4],
            ],
        },
        parry: {
            pixels: [
                [10, 14, 2],
                [11, 14, 3],
                [10, 15, 3],
                [11, 15, 4],
                [21, 17, 2],
                [22, 17, 3],
                [23, 17, 4],
                [22, 18, 4],
                [23, 18, 4],
            ],
        },
        buff: {
            pixels: [
                [10, 14, 2],
                [11, 14, 3],
                [25, 14, 2],
                [26, 14, 3],
                [10, 15, 3],
                [11, 15, 4],
                [25, 15, 3],
                [26, 15, 4],
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

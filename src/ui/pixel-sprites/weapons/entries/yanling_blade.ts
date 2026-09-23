/**
 * 武器「yanling_blade」（惊鸿）：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

/**
 * 惊鸿（雁翎刀形制）：**以绣冬为底，刀身收窄一格**。
 *
 * 绣冬的刀身是每行 3 格横排的 45 度带（中间调 3 / 亮 4 / 暗 1），这里去掉最靠刀背的那格
 * （中间调 3），只留「亮 + 暗」两格；刀尖收尖、护手、缠绳、柄首的点位与绣冬一字未动。
 * 调色板沿用绣冬那一份、下标一个没动：3 号色（中间调）现在没人在用，但键还在、
 * 颜色仍是原值。要删就在编辑器里删 —— 删了只留空位、下标不重排。
 */
const PALETTE: Record<string, string> = {
    '1': '#6d7378',
    '2': '#d1d1d1',
    '3': '#7d7d7d',
    '4': '#b3b3b3',
    '5': '#7c5c18',
    '6': '#835311',
    '7': '#9f3304',
}

export const yanling_blade: { overlay?: WeaponOverlay; poses: WeaponPoseTable } = {
    // weapons/entries/yanling_blade.ts → overlay:
    overlay: {
        palette: PALETTE,
        pixels: [
            [8, 5, 4],
            [8, 6, 2],
            [9, 6, 1],
            [9, 7, 2],
            [10, 7, 1],
            [9, 8, 2],
            [10, 8, 1],
            [11, 8, 1],
            [10, 9, 2],
            [11, 9, 1],
            [12, 9, 1],
            [11, 10, 1],
            [12, 10, 1],
            [12, 11, 1],
            [13, 11, 1],
            [13, 12, 1],
            [14, 12, 1],
            [14, 13, 1],
            [15, 13, 1],
            [15, 14, 1],
            [16, 14, 1],
            [16, 15, 1],
            [17, 15, 1],
            [17, 16, 1],
            [18, 16, 3],
            [18, 17, 1],
            [19, 17, 3],
            [19, 18, 1],
            [20, 18, 3],
            [20, 19, 5],
            [21, 19, 5],
            [22, 19, 6],
            [20, 20, 6],
            [21, 20, 7],
            [22, 20, 7],
            [22, 21, 7],
            [23, 21, 7],
            [23, 22, 7],
            [24, 22, 7],
            [24, 23, 7],
            [25, 23, 7],
            [25, 24, 6],
        ],
    },
    // weapons/entries/yanling_blade.ts → poses:
    poses: {
        ...makePoses({ gripX: 21.5, gripY: 20.5, anchorHand: 'main' }),
        idle: { angle: 0 },
        attack: { gripDX: 0.5 },
        parry: { gripDX: 0.5, gripDY: 1, angle: 2.0228 },
        hit: { angle: (18 * Math.PI) / 180, handDX: 1, handDY: -2.5 },
        off: {
            ...makePoses({}),
            idle: { angle: 0 },
            attack: { angle: 0 },
            dodge: { angle: 0 },
            parry: { angle: (-10 * Math.PI) / 180 },
            hit: { angle: (58 * Math.PI) / 180, handDX: 5.5, handDY: -3 },
            buff: { gripDY: 1, flip: true, angle: (-90 * Math.PI) / 180 },
        },
    },
}

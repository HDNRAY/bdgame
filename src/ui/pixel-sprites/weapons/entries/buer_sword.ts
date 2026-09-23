/**
 * 武器「buer_sword」（不二剑）：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

// weapons/entries/buer_sword.ts 顶部：这把武器**所有图共用**的调色板（下标 = 这里的键）
const PALETTE: Record<string, string> = {
    '1': '#8c979b',
    '2': '#a7b0b4',
    '3': '#95a1a7',
    '7': '#78868c',
}

export const buer_sword: { overlay?: WeaponOverlay; poses: WeaponPoseTable } = {
    // weapons/entries/buer_sword.ts → 替换 overlay 那一条（共用调色板挂在这一条上，别丢）
    overlay: {
        palette: PALETTE,
        pixels: [
            [9, 9, 2],
            [10, 9, 2],
            [9, 10, 2],
            [10, 10, 1],
            [11, 10, 2],
            [10, 11, 3],
            [11, 11, 1],
            [12, 11, 2],
            [11, 12, 3],
            [12, 12, 1],
            [13, 12, 2],
            [12, 13, 3],
            [13, 13, 1],
            [14, 13, 2],
            [13, 14, 3],
            [14, 14, 1],
            [15, 14, 2],
            [14, 15, 3],
            [15, 15, 1],
            [16, 15, 2],
            [15, 16, 3],
            [16, 16, 1],
            [17, 16, 2],
            [16, 17, 3],
            [17, 17, 2],
            [18, 17, 2],
            [19, 17, 2],
            [17, 18, 3],
            [19, 18, 2],
            [17, 19, 3],
            [18, 19, 3],
            [19, 19, 7],
            [20, 20, 7],
            [21, 21, 7],
        ],
    },
    // weapons/entries/buer_sword.ts → poses:
    poses: {
        ...makePoses({ gripX: 19, gripY: 19 }),
        attack: { gripDX: 0.5 },
        parry: { gripDY: 1, angle: 2.0577 },
        hit: { angle: (23 * Math.PI) / 180, handDX: 1.5, handDY: -2.5 },
        off: {
            ...makePoses({}),
            idle: { angle: 0 },
            attack: { angle: (-30 * Math.PI) / 180 },
            dodge: { angle: 0 },
            parry: { angle: (-10 * Math.PI) / 180 },
            hit: { angle: (58 * Math.PI) / 180, handDX: 4, handDY: -3 },
            buff: { gripDY: 1, angle: (90 * Math.PI) / 180 },
        },
    },
}

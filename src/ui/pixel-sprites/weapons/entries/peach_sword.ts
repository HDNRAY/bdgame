/**
 * 武器「peach_sword」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

// 桃木剑：单手剑。招架时主手锚定（面前抬手），剑身旋转斜穿副手（腰间握持），只给主手遮罩
export const peach_sword: { overlay?: WeaponOverlay; poses: WeaponPoseTable } = {
    // weapons/entries/peach_sword.ts → overlay:
    overlay: {
        palette: {
            '1': '#e8b078',
            '2': '#dba870',
            '3': '#ecbc7e',
            '4': '#ffb6c1',
            '5': '#ff9fb2',
            '6': '#8a5a3a',
            '7': '#6b3a1a',
        },
        pixels: [
            [8, 7, 1],
            [9, 7, 2],
            [8, 8, 3],
            [9, 8, 1],
            [10, 8, 2],
            [9, 9, 3],
            [10, 9, 1],
            [11, 9, 2],
            [10, 10, 3],
            [11, 10, 1],
            [12, 10, 2],
            [11, 11, 3],
            [12, 11, 1],
            [13, 11, 2],
            [12, 12, 3],
            [13, 12, 1],
            [14, 12, 2],
            [13, 13, 3],
            [14, 13, 1],
            [15, 13, 2],
            [14, 14, 3],
            [15, 14, 1],
            [16, 14, 2],
            [15, 15, 3],
            [16, 15, 1],
            [17, 15, 2],
            [16, 16, 3],
            [17, 16, 1],
            [18, 16, 2],
            [17, 17, 3],
            [18, 17, 1],
            [19, 17, 2],
            [21, 17, 4],
            [18, 18, 3],
            [19, 18, 1],
            [20, 18, 4],
            [21, 18, 4],
            [19, 19, 5],
            [20, 19, 5],
            [21, 19, 6],
            [18, 20, 4],
            [19, 20, 4],
            [20, 20, 6],
            [21, 20, 7],
            [22, 21, 7],
            [23, 22, 7],
            [24, 23, 7],
        ],
    },
    // weapons/entries/peach_sword.ts → poses:
    poses: {
        ...makePoses({ gripX: 21.5, gripY: 20.5 }),
        attack: { gripDX: 0.5 },
        parry: { gripDX: 0.5, gripDY: 0.5, angle: 2.6857 },
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

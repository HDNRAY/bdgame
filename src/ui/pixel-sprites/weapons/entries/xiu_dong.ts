/**
 * 武器「xiu_dong」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

// 绣冬：点位与桃木剑逐字一致（握点 24,24 + 同一套 parry/hit 角度），便于对照与替换
export const xiu_dong: { overlay?: WeaponOverlay; poses: WeaponPoseTable } = {
    // weapons/entries/xiu_dong.ts → overlay:
    overlay: {
        palette: {
            '1': '#6c767f',
            '2': '#bac4c9',
            '3': '#8896a5',
            '4': '#d6dee6',
            '5': '#0b252d',
            '6': '#113540',
            '7': '#1d2835',
            '8': '#384452',
        },
        pixels: [
            [7, 5, 1],
            [7, 6, 1],
            [8, 6, 1],
            [7, 7, 1],
            [8, 7, 2],
            [9, 7, 1],
            [8, 8, 1],
            [9, 8, 2],
            [10, 8, 1],
            [9, 9, 1],
            [10, 9, 2],
            [11, 9, 1],
            [10, 10, 3],
            [11, 10, 2],
            [12, 10, 1],
            [11, 11, 3],
            [12, 11, 4],
            [13, 11, 1],
            [12, 12, 3],
            [13, 12, 4],
            [14, 12, 1],
            [13, 13, 3],
            [14, 13, 4],
            [15, 13, 1],
            [14, 14, 3],
            [15, 14, 4],
            [16, 14, 1],
            [15, 15, 3],
            [16, 15, 4],
            [17, 15, 1],
            [16, 16, 3],
            [17, 16, 4],
            [18, 16, 1],
            [17, 17, 3],
            [18, 17, 4],
            [19, 17, 1],
            [18, 18, 3],
            [19, 18, 4],
            [20, 18, 1],
            [21, 18, 5],
            [19, 19, 3],
            [20, 19, 5],
            [21, 19, 5],
            [19, 20, 6],
            [20, 20, 6],
            [21, 20, 7],
            [21, 21, 8],
            [22, 21, 7],
            [22, 22, 8],
            [23, 22, 7],
            [23, 23, 8],
            [24, 23, 7],
            [24, 24, 8],
        ],
    },
    // weapons/entries/xiu_dong.ts → poses:
    poses: {
        ...makePoses({ gripX: 21.5, gripY: 20.5, anchorHand: 'main' }),
        idle: { angle: 0 },
        attack: { gripDX: 0.5 },
        parry: { gripDX: 0.5, gripDY: 1.5, angle: 2.0228 },
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

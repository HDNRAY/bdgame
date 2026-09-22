/**
 * 武器「chun_lei」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

// 春雷（二尺四寸 / 一斤三两 / 吹毛断发）：轻短弧刃，握点取柄的质心
export const chun_lei: { overlay?: WeaponOverlay; poses: WeaponPoseTable } = {
    overlay: {
        palette: { '1': '#eef0f1', '2': '#dfe3e7', '3': '#bfe9ff', '4': '#2f3a4a', '5': '#1d2430', '6': '#ffffff' },
        pixels: [
            [12, 10, 6],
            [12, 11, 1],
            [13, 11, 6],
            [12, 12, 2],
            [13, 12, 1],
            [14, 12, 6],
            [13, 13, 2],
            [14, 13, 1],
            [15, 13, 6],
            [14, 14, 2],
            [15, 14, 1],
            [16, 14, 6],
            [15, 15, 2],
            [16, 15, 1],
            [17, 15, 6],
            [16, 16, 2],
            [17, 16, 1],
            [18, 16, 6],
            [17, 17, 2],
            [18, 17, 1],
            [19, 17, 6],
            [20, 17, 4],
            [18, 18, 2],
            [19, 18, 4],
            [20, 18, 4],
            [18, 19, 4],
            [19, 19, 4],
            [20, 19, 5],
            [20, 20, 4],
            [21, 20, 5],
            [21, 21, 5],
            [22, 21, 5],
            [22, 22, 3],
        ],
    },
    // weapons/entries/chun_lei.ts → poses:
    poses: {
        ...makePoses({ gripX: 20, gripY: 19.5, anchorHand: 'off' }),
        idle: { handDX: -10 },
        attack: { gripDY: -0.5, handDY: 0.5 },
        dodge: { gripDY: -1 },
        parry: { angle: 2.1276, handDX: -11.5, handDY: -3 },
        hit: { gripDX: 0.5, gripDY: 1, angle: (15 * Math.PI) / 180, handDX: 1.5, handDY: -5.5 },
        buff: { gripDY: -1, anchorHand: 'main' },
        off: {
            ...makePoses({ gripX: 21, gripY: 20.5 }),
            idle: { gripDX: -0.5, gripDY: -1, angle: 0 },
            attack: { gripDY: -0.5, angle: (-35 * Math.PI) / 180 },
            dodge: { gripDX: -0.5, gripDY: -1, angle: 0 },
            parry: { gripDY: -0.5, angle: (-8 * Math.PI) / 180, handDX: 0.5 },
            hit: { gripDX: -0.5, angle: (58 * Math.PI) / 180, handDX: 4.5, handDY: -4 },
            buff: { angle: (90 * Math.PI) / 180 },
        },
    },
}

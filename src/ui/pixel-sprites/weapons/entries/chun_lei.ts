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
    // weapons/entries/chun_lei.ts → overlay:
    overlay: {
        palette: {
            '1': '#ffffff',
            '2': '#eef0f1',
            '3': '#dfe3e7',
            '4': '#2f3a4a',
            '5': '#1d2430',
            '6': '#bfe9ff',
        },
        pixels: [
            [11, 9, 1],
            [11, 10, 2],
            [12, 10, 1],
            [11, 11, 3],
            [12, 11, 2],
            [13, 11, 1],
            [12, 12, 3],
            [13, 12, 2],
            [14, 12, 1],
            [13, 13, 3],
            [14, 13, 2],
            [15, 13, 1],
            [14, 14, 3],
            [15, 14, 2],
            [16, 14, 1],
            [15, 15, 3],
            [16, 15, 2],
            [17, 15, 1],
            [16, 16, 3],
            [17, 16, 2],
            [18, 16, 1],
            [19, 16, 4],
            [17, 17, 3],
            [18, 17, 4],
            [19, 17, 4],
            [17, 18, 4],
            [18, 18, 4],
            [19, 18, 5],
            [19, 19, 4],
            [20, 19, 5],
            [20, 20, 5],
            [21, 20, 5],
            [21, 21, 6],
        ],
    },
    // weapons/entries/chun_lei.ts → poses:
    poses: {
        ...makePoses({ gripX: 19.5, gripY: 18.5, anchorHand: 'off' }),
        idle: { handDX: -10 },
        attack: { gripDX: 0.5, gripDY: 0.5 },
        parry: { gripDX: 0.5, gripDY: 1.5, angle: 2.0403, handDX: -11.5, handDY: -3 },
        hit: { angle: (15 * Math.PI) / 180, handDX: 1.5, handDY: -5.5 },
        buff: { anchorHand: 'main' },
        off: {
            ...makePoses({}),
            idle: { angle: 0 },
            attack: { gripDX: 0.5, angle: (-35 * Math.PI) / 180 },
            dodge: { angle: 0 },
            parry: { angle: (-8 * Math.PI) / 180, handDX: 0.5 },
            hit: { angle: (58 * Math.PI) / 180, handDX: 4.5, handDY: -4 },
            buff: { gripDY: 1, flip: true, angle: (-90 * Math.PI) / 180 },
        },
    },
}

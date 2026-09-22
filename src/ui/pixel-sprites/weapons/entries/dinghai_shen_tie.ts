/**
 * 武器「dinghai_shen_tie」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

export const dinghai_shen_tie: { overlay?: WeaponOverlay; poses: WeaponPoseTable } = {
    overlay: {
        palette: {
            '0': '#525a68', // 柱身（中，深色铁）
            '1': '#343a45', // 柱身暗侧
            '4': '#c9973a', // 金箍（中）
            '5': '#8a6522', // 金箍暗侧
            '6': '#e8c065', // 金箍亮边
        },
        pixels: [
            [3, 3, 6],
            [4, 3, 5],
            [4, 4, 4],
            [5, 4, 5],
            [5, 5, 4],
            [6, 5, 5],
            [6, 6, 4],
            [7, 6, 5],
            [7, 7, 4],
            [8, 7, 5],
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
            [23, 22, 5],
            [23, 23, 4],
            [24, 23, 5],
            [24, 24, 4],
            [25, 24, 5],
            [25, 25, 4],
            [26, 25, 5],
            [26, 26, 4],
            [27, 26, 5],
            [27, 27, 6],
        ],
    },
    poses: {
        ...makePoses({ anchorHand: 'off', gripX: 22.5, gripY: 21, flip: true }),
        idle: { angle: (135 * Math.PI) / 180 },
        attack: { gripDX: 2, gripDY: 2, angle: 2.2759 },
        dodge: { angle: (135 * Math.PI) / 180 },
        parry: { gripDY: 0.5, angle: (149 * Math.PI) / 180 },
        hit: { flip: false, angle: (-120 * Math.PI) / 180, handDX: -18, handDY: -20 },
        buff: { angle: (135 * Math.PI) / 180 },
    },
}

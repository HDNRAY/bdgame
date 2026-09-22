/**
 * 武器「long_spear」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

// 长枪（双手长杆 + 枪头）：握持配置与破狼竹枝逐字一致（含 flip；枪头在美术左上端，与竹枝嫩竹同端）
export const long_spear: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = {
    overlay: {
        palette: {
            '3': '#8a90a0', // 枪头 中
            '1': '#5b6270', // 枪头 暗
            '2': '#d0d6e0', // 枪头 亮
            '4': '#b08a3c', // 铜箍 中
            '5': '#7a5c22', // 铜箍 暗
            '6': '#e0bb62', // 铜箍 亮
            '7': '#9a6d33', // 杆身 中（木）
            '8': '#6e441a', // 杆身 暗（木）
        },
        pixels: [
            [3, 3, 2],
            [4, 3, 3],
            [4, 4, 2],
            [5, 4, 3],
            [5, 5, 2],
            [6, 5, 3],
            [6, 6, 2],
            [7, 6, 3],
            [7, 7, 2],
            [8, 7, 4],
            [8, 8, 6],
            [9, 8, 8],
            [9, 9, 7],
            [10, 9, 8],
            [10, 10, 7],
            [11, 10, 8],
            [11, 11, 7],
            [12, 11, 8],
            [12, 12, 7],
            [13, 12, 8],
            [13, 13, 7],
            [14, 13, 8],
            [14, 14, 7],
            [15, 14, 8],
            [15, 15, 7],
            [16, 15, 8],
            [16, 16, 7],
            [17, 16, 8],
            [17, 17, 7],
            [18, 17, 8],
            [18, 18, 7],
            [19, 18, 8],
            [19, 19, 7],
            [20, 19, 8],
            [20, 20, 7],
            [21, 20, 8],
            [21, 21, 7],
            [22, 21, 8],
            [22, 22, 7],
            [23, 22, 8],
            [23, 23, 7],
            [24, 23, 8],
            [24, 24, 7],
            [25, 24, 8],
            [25, 25, 7],
            [26, 25, 8],
            [26, 26, 7],
            [27, 26, 8],
            [27, 27, 7],
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

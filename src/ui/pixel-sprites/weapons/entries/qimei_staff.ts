/**
 * 武器「qimei_staff」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

// weapons/entries/qimei_staff.ts 顶部：这把武器**所有图共用**的调色板（下标 = 这里的键）
const PALETTE: Record<string, string> = {
    '1': '#6e441a',
    '2': '#9a6d33',
}

// 齐眉棍（双手长杆）：握点取「杆中点落在主手（画面左侧那只手）」的位置
// 两手间距 idle/dodge 9.5 格、attack 12.5 格、parry 12.2 格 → attack/parry 握点相应前移
// flip 为反向握持（整根杆掉头，长端朝角色正面）
export const qimei_staff: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = {
    // weapons/entries/qimei_staff.ts → 替换 overlay 那一条（共用调色板挂在这一条上，别丢）
    overlay: {
        palette: PALETTE,
        pixels: [
            [4, 4, 2],
            [5, 4, 1],
            [5, 5, 2],
            [6, 5, 1],
            [6, 6, 2],
            [7, 6, 1],
            [7, 7, 2],
            [8, 7, 1],
            [8, 8, 2],
            [9, 8, 1],
            [9, 9, 2],
            [10, 9, 1],
            [10, 10, 2],
            [11, 10, 1],
            [11, 11, 2],
            [12, 11, 1],
            [12, 12, 2],
            [13, 12, 1],
            [13, 13, 2],
            [14, 13, 1],
            [14, 14, 2],
            [15, 14, 1],
            [15, 15, 2],
            [16, 15, 1],
            [16, 16, 2],
            [17, 16, 1],
            [17, 17, 2],
            [18, 17, 1],
            [18, 18, 2],
            [19, 18, 1],
            [19, 19, 2],
            [20, 19, 1],
            [20, 20, 2],
            [21, 20, 1],
            [21, 21, 2],
            [22, 21, 1],
            [22, 22, 2],
            [23, 22, 1],
            [23, 23, 2],
            [24, 23, 1],
            [24, 24, 2],
            [25, 24, 1],
            [25, 25, 2],
            [26, 25, 1],
            [26, 26, 2],
            [27, 26, 1],
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

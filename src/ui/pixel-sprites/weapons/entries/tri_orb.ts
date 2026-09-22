/**
 * 武器「tri_orb」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'


export const tri_orb: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = { overlay: { pixels: [
            // 上珠（白）— 偏白渐变，高光→底色→阴影
            [15, 4, '#f2f2f2'],
            [16, 4, '#dfdfdf'],
            [14, 5, '#f2f2f2'],
            [15, 5, '#dfdfdf'],
            [16, 5, '#dfdfdf'],
            [17, 5, '#c2c2c2'],
            [14, 6, '#dfdfdf'],
            [15, 6, '#dfdfdf'],
            [16, 6, '#dfdfdf'],
            [17, 6, '#c2c2c2'],
            [15, 7, '#dfdfdf'],
            [16, 7, '#c2c2c2'],
            // 左下珠（灰）— 中灰渐变
            [5, 22, '#d4d4d4'],
            [6, 22, '#a3a3a3'],
            [4, 23, '#d4d4d4'],
            [5, 23, '#a3a3a3'],
            [6, 23, '#a3a3a3'],
            [7, 23, '#6f6f6f'],
            [4, 24, '#a3a3a3'],
            [5, 24, '#a3a3a3'],
            [6, 24, '#a3a3a3'],
            [7, 24, '#6f6f6f'],
            [5, 25, '#a3a3a3'],
            [6, 25, '#6f6f6f'],
            // 右下珠（黑）— 偏黑渐变
            [25, 22, '#7a7a7a'],
            [26, 22, '#4d4d4d'],
            [24, 23, '#7a7a7a'],
            [25, 23, '#4d4d4d'],
            [26, 23, '#4d4d4d'],
            [27, 23, '#262626'],
            [24, 24, '#4d4d4d'],
            [25, 24, '#4d4d4d'],
            [26, 24, '#4d4d4d'],
            [27, 24, '#262626'],
            [25, 25, '#4d4d4d'],
            [26, 25, '#262626'],
        ] },
    poses: {
        ...makePoses({ gripX: 9, gripY: 22 }),
        idle: { angle: (-37 * Math.PI) / 180 },
        attack: { angle: (-80 * Math.PI) / 180, handDX: -34, handDY: 5.5 },
        dodge: { angle: (-37 * Math.PI) / 180, handDX: -2 },
        parry: { gripDX: 6, gripDY: -7, angle: (204 * Math.PI) / 180, handDX: 3.5, handDY: 2.5 },
        hit: { angle: (-20 * Math.PI) / 180, handDX: 7, handDY: -9 },
        buff: { gripDX: 7, gripDY: -6, angle: (-60 * Math.PI) / 180, handDX: 6.5, handDY: -11 },
    },
}

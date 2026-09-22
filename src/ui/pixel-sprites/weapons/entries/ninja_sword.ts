/**
 * 武器「xiu_dong」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

// 绣冬：点位与桃木剑逐字一致（握点 24,24 + 同一套 parry/hit 角度），便于对照与替换
export const ninja_sword: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = {
    // weapons/entries/ninja_sword.ts → overlay:
    overlay: {
        palette: {
            '1': '#969696',
            '2': '#808080',
            '3': '#111212',
            '4': '#242424',
        },
        pixels: [
            [8, 6, 1],
            [8, 7, 2],
            [9, 7, 1],
            [9, 8, 2],
            [10, 8, 1],
            [10, 9, 2],
            [11, 9, 1],
            [11, 10, 2],
            [12, 10, 1],
            [12, 11, 2],
            [13, 11, 1],
            [13, 12, 2],
            [14, 12, 1],
            [14, 13, 2],
            [15, 13, 1],
            [15, 14, 2],
            [16, 14, 1],
            [16, 15, 2],
            [17, 15, 1],
            [17, 16, 2],
            [18, 16, 1],
            [18, 17, 2],
            [19, 17, 1],
            [19, 18, 1],
            [20, 18, 1],
            [18, 19, 1],
            [19, 19, 1],
            [20, 19, 4],
            [21, 19, 3],
            [21, 20, 4],
            [22, 20, 3],
            [22, 21, 4],
            [23, 21, 3],
            [22, 22, 3],
            [23, 22, 1],
        ],
    },
    // weapons/entries/ninja_sword.ts → poses:
    poses: {
        ...makePoses({ gripX: 20.5, gripY: 19.5, anchorHand: 'main' }),
        idle: { angle: 0 },
        attack: { gripDX: 1, angle: (-45 * Math.PI) / 180 },
        parry: { gripDX: 0.5, gripDY: 1, angle: 2.0228 },
        hit: { angle: (18 * Math.PI) / 180, handDX: 1, handDY: -2.5 },
        off: {
            ...makePoses({}),
            idle: { angle: 0 },
            attack: { angle: (-32 * Math.PI) / 180 },
            dodge: { angle: 0 },
            parry: { angle: (-10 * Math.PI) / 180 },
            hit: { angle: (58 * Math.PI) / 180, handDX: 5.5, handDY: -3 },
            buff: { gripDY: 1, flip: true, angle: (-90 * Math.PI) / 180 },
        },
    },
}

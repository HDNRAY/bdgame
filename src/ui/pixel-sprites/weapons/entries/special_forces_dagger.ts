/**
 * 武器「special_forces_dagger」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

export const special_forces_dagger: { overlay?: WeaponOverlay; poses: WeaponPoseTable } = {
    // weapons/entries/special_forces_dagger.ts → overlay:
    overlay: {
        palette: {
            '1': '#1e3933',
            '2': '#0b473b',
            '3': '#061816',
            '4': '#194d36',
        },
        pixels: [
            [14, 13, 1],
            [14, 14, 2],
            [15, 14, 1],
            [14, 15, 4],
            [15, 15, 2],
            [16, 15, 1],
            [15, 16, 4],
            [16, 16, 2],
            [17, 16, 1],
            [16, 17, 4],
            [17, 17, 2],
            [18, 17, 1],
            [17, 18, 4],
            [18, 18, 2],
            [19, 18, 1],
            [18, 19, 4],
            [19, 19, 2],
            [20, 19, 3],
            [19, 20, 4],
            [20, 20, 3],
            [21, 20, 3],
            [21, 21, 3],
            [22, 21, 3],
            [22, 22, 3],
            [23, 22, 3],
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

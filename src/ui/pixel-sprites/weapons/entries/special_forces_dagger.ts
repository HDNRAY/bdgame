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
            [20, 19, 1],
            [19, 20, 4],
            [20, 20, 2],
            [21, 20, 3],
            [20, 21, 3],
            [21, 21, 3],
            [22, 21, 3],
            [22, 22, 3],
            [23, 22, 3],
            [23, 23, 3],
            [24, 23, 3],
        ],
    },
    // weapons/entries/special_forces_dagger.ts → poses:
    poses: {
        ...makePoses({ gripX: 20.5, gripY: 20, anchorHand: 'main' }),
        attack: { gripDX: 1, gripDY: 0.5 },
        parry: { gripDY: 2 },
        off: {
            ...makePoses({}),
            attack: { gripDX: 0.5 },
            parry: { handDX: 0.5 },
            hit: { handDX: 4.5, handDY: -4 },
            buff: { gripDY: 0.5 },
        },
    },
}

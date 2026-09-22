/**
 * 武器「special_forces_dagger」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

export const special_forces_dagger: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = {
    // weapons/entries/special_forces_dagger.ts → overlay:
    overlay: {
        palette: {
            '1': '#1e3933',
            '2': '#0b473b',
            '3': '#061816',
            '4': '#194d36',
        },
        pixels: [
            [11, 10, 1],
            [11, 11, 2],
            [12, 11, 1],
            [11, 12, 4],
            [12, 12, 2],
            [13, 12, 1],
            [12, 13, 4],
            [13, 13, 2],
            [14, 13, 1],
            [13, 14, 4],
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
            [18, 17, 3],
            [16, 18, 3],
            [17, 18, 3],
            [18, 18, 3],
            [19, 18, 3],
            [19, 19, 3],
            [20, 19, 3],
            [20, 20, 3],
            [21, 20, 3],
        ],
    },
    // weapons/entries/special_forces_dagger.ts → poses:
    poses: {
        ...makePoses({ gripX: 18.5, gripY: 18, anchorHand: 'main' }),
        attack: { gripDX: 1, gripDY: 0.5 },
        parry: { gripDY: 1.5, angle: (105 * Math.PI) / 180 },
        hit: { angle: (29 * Math.PI) / 180, handDX: 2, handDY: -4.5 },
        off: {
            ...makePoses({}),
            attack: { gripDX: 0.5, angle: (-27 * Math.PI) / 180 },
            parry: { angle: (-6 * Math.PI) / 180, handDX: 0.5 },
            hit: { angle: (57 * Math.PI) / 180, handDX: 4.5, handDY: -4 },
            buff: { gripDX: -2.5, gripDY: -0.5, flip: true, angle: (-91 * Math.PI) / 180 },
        },
    },
}

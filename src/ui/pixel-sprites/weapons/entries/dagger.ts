/**
 * 武器「dagger」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

export const dagger: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = {
    // weapons/entries/dagger.ts → overlay:
    overlay: {
        palette: {
            '1': '#ffffff',
            '2': '#dfe3e7',
            '3': '#a66c08',
            '4': '#211717',
            '5': '#d9c545',
        },
        pixels: [
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
            [19, 18, 3],
            [20, 18, 3],
            [18, 19, 3],
            [19, 19, 3],
            [20, 19, 4],
            [20, 20, 4],
            [21, 20, 4],
            [21, 21, 4],
            [22, 21, 5],
        ],
    },
    // weapons/entries/dagger.ts → poses:
    poses: {
        ...makePoses({ gripX: 20.5, gripY: 19.5, anchorHand: 'main' }),
        attack: { gripDX: 0.5 },
        parry: { gripDY: 1.5 },
        hit: { handDX: 2.5, handDY: -4.5 },
        off: {
            ...makePoses({}),
            hit: { handDX: 4.5, handDY: -4 },
            buff: { angle: (90 * Math.PI) / 180, handDX: 1 },
        },
    },
}

/**
 * 武器「dagger」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'


export const dagger: { overlay?: WeaponOverlay; poses: WeaponPoseTable } = { overlay: { pixels: [
            [7, -2, '#d8d8d8'],
            [8, -1, '#d8d8d8'],
            [9, 0, '#d8d8d8'],
            [10, 1, '#d8d8d8'],
            [8, -3, '#996633'],
        ] },
    poses: makePoses({ gripX: 8, gripY: -3 }) }

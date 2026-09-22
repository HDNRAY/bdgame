/**
 * 武器「bare_hands」：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'


// 每个武器独立设定（哪怕同类型也不共享），便于逐武器微调 grip/角度/锚定手
export const bare_hands: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = { overlay: { pixels: [] },
    poses: makePoses({ gripX: 0, gripY: 0 }) }

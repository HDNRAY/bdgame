/**
 * 武器「overlord_blade」（素铁霸刀）：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 *
 * 形制按「陌刀」画：**沿轴一半刀身、一半柄**，护手落在正中间那一级（k = 33）。
 * 刀身是一块宽厚的板（最宽 9 格，是柄的三倍多），不是中间鼓、两头细的纺锤：
 * 刀尖 3 档收成 1~3 格，之后逐档最多收 2 格；23 档里 19 档 ≥ 6 格、9 档 ≥ 8 格，靠柄端略收到 6 格。
 * 单刃 —— 刃口是 -v 侧（低 d = y-x）那条连续亮线，一路通到刀尖；脊背在 +v 侧压暗，不做剑那样的对称双刃。
 * 素面冷灰铁色，少装饰；柄是可辨的握持段（素铁杆 + 缠绳箍 + 柄首），仍只有 2~3 格宽，宽窄对比即「霸」。
 * 刀尖在美术网格左上端（k = x+y 最小处），柄往右下收；沿轴跨度 max(x+y) − min(x+y) = 46 格。
 * 与枪 / 戟的区别不在「柄短」，而在**刀身宽大厚重**（枪戟是细杆 + 左上一个小头）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

// weapons/entries/overlord_blade.ts 顶部：这把武器**所有图共用**的调色板（下标 = 这里的键）
const PALETTE: Record<string, string> = {
    '1': '#ffffff',
    '2': '#dedede',
    '3': '#c2660f',
    '5': '#2b1b08',
}

// 素铁霸刀（双手陌刀）：握点取柄（后半段）的中点，锚副手（anchorHand: 'off'），两手都在柄上。
export const overlord_blade: { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable } = {
    // weapons/entries/overlord_blade.ts → 替换 overlay 那一条（共用调色板挂在这一条上，别丢）
    overlay: {
        palette: PALETTE,
        pixels: [
            [6, 5, 1],
            [6, 6, 1],
            [7, 6, 1],
            [6, 7, 2],
            [7, 7, 1],
            [8, 7, 1],
            [7, 8, 2],
            [8, 8, 1],
            [9, 8, 1],
            [8, 9, 2],
            [9, 9, 1],
            [10, 9, 1],
            [9, 10, 2],
            [10, 10, 1],
            [11, 10, 1],
            [10, 11, 2],
            [11, 11, 1],
            [12, 11, 1],
            [11, 12, 2],
            [12, 12, 1],
            [13, 12, 1],
            [12, 13, 2],
            [13, 13, 1],
            [14, 13, 1],
            [15, 13, 3],
            [13, 14, 1],
            [14, 14, 3],
            [15, 14, 3],
            [13, 15, 3],
            [14, 15, 3],
            [15, 15, 5],
            [16, 15, 5],
            [16, 16, 5],
            [17, 16, 5],
            [17, 17, 5],
            [18, 17, 5],
            [18, 18, 5],
            [19, 18, 5],
            [19, 19, 5],
            [20, 19, 5],
            [20, 20, 5],
            [21, 20, 5],
            [21, 21, 5],
            [22, 21, 5],
            [22, 22, 5],
            [23, 22, 5],
            [23, 23, 5],
            [24, 23, 5],
            [24, 24, 5],
            [25, 24, 5],
            [25, 25, 3],
            [26, 25, 3],
        ],
    },
    // weapons/entries/overlord_blade.ts → poses:
    poses: {
        ...makePoses({ gripX: 17.5, gripY: 18, flip: true, anchorHand: 'off' }),
        idle: { angle: (289 * Math.PI) / 180 },
        attack: { gripDX: -3, gripDY: -2, angle: (-220 * Math.PI) / 180, handDX: -12, handDY: 1 },
        dodge: { angle: (289 * Math.PI) / 180 },
        parry: { gripDX: -3, gripDY: -2, angle: (123 * Math.PI) / 180, handDX: -11.5, handDY: -3 },
        hit: { angle: (37 * Math.PI) / 180, handDX: 6, handDY: -7 },
        buff: { gripDY: -0.5, flip: false, angle: 0, handDX: -15 },
    },
}

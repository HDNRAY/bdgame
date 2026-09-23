/**
 * 武器「fusi_sword」（弗思剑）：美术叠加层 + 各姿势挂点配置（一个武器一个文件）。
 *
 * 画法约定：轴向几何（u = (A-x-y)·√½ / v = (y-x)·√½），刃朝美术网格左上端，颜色索引必须写数字。
 * 挂点口径见 `../hands.ts`（锚点=遮罩正中）与 `../poses.ts`（makePoses 基底 + 逐姿势微调）。
 */
import type { WeaponOverlay } from '../../types'
import { makePoses, type WeaponPoseTable } from '../poses'

/**
 * 弗思剑（原型：景阳真人佩剑，「剑光如炽」「道心纯粹」——打磨极亮、线条极干净，没有多余装饰。）
 *
 * **点位与桃木剑逐格一模一样**（坐标与下标都没动），只换调色板的值：
 * 桃木剑的 1 是中间那条线、2 / 3 是两侧，所以按「脊 / 两侧」的关系配色。
 * 护手 4 / 5、缠绳 6、柄首 7 同样只换颜色。
 * 明暗关系：**两侧的刃口最亮、中间的剑脊压暗**（1 是脊、2/3 是两条刃，刃同色 → 颜色也对称）。
 * 三阶**同色系、明暗只差一档**（照桃木剑那组的分寸），不做大反差。
 */
// weapons/entries/fusi_sword.ts 顶部：这把武器**所有图共用**的调色板（下标 = 这里的键）
const PALETTE: Record<string, string> = {
    '1': '#89010a',
    '2': '#80000b',
    '3': '#94000c',
    '4': '#3e1e0a',
    '6': '#2a1909',
    '7': '#8f2020',
}

export const fusi_sword: { overlay?: WeaponOverlay; poses: WeaponPoseTable } = {
    // weapons/entries/fusi_sword.ts → 替换 overlay 那一条（共用调色板挂在这一条上，别丢）
    overlay: {
        palette: PALETTE,
        pixels: [
            [7, 7, 3],
            [8, 7, 3],
            [7, 8, 3],
            [8, 8, 1],
            [9, 8, 3],
            [8, 9, 3],
            [9, 9, 1],
            [10, 9, 3],
            [9, 10, 3],
            [10, 10, 1],
            [11, 10, 3],
            [10, 11, 2],
            [11, 11, 1],
            [12, 11, 3],
            [11, 12, 2],
            [12, 12, 1],
            [13, 12, 3],
            [12, 13, 2],
            [13, 13, 1],
            [14, 13, 2],
            [13, 14, 2],
            [14, 14, 1],
            [15, 14, 2],
            [14, 15, 2],
            [15, 15, 1],
            [16, 15, 2],
            [15, 16, 2],
            [16, 16, 1],
            [17, 16, 1],
            [16, 17, 1],
            [17, 17, 1],
            [18, 17, 1],
            [17, 18, 1],
            [18, 18, 4],
            [19, 18, 1],
            [20, 18, 4],
            [21, 18, 6],
            [18, 19, 1],
            [19, 19, 4],
            [20, 19, 6],
            [18, 20, 4],
            [19, 20, 6],
            [20, 20, 6],
            [18, 21, 6],
            [21, 21, 6],
            [22, 22, 7],
            [23, 23, 6],
        ],
    },
    // weapons/entries/fusi_sword.ts → poses:
    poses: {
        ...makePoses({ gripX: 21, gripY: 21 }),
        attack: { gripDX: 0.5 },
        parry: { gripDY: 1, angle: 2.0577 },
        hit: { angle: (23 * Math.PI) / 180, handDX: 1.5, handDY: -2.5 },
        off: {
            ...makePoses({}),
            idle: { angle: 0 },
            attack: { angle: (-30 * Math.PI) / 180 },
            dodge: { angle: 0 },
            parry: { angle: (-10 * Math.PI) / 180 },
            hit: { angle: (58 * Math.PI) / 180, handDX: 4, handDY: -3 },
            buff: { gripDY: 1, angle: (90 * Math.PI) / 180 },
        },
    },
}

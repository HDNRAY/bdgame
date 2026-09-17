/**
 * 拖拽排序的落点计算（纯函数，便于单测）。
 *
 * 招式行用的是 `display: contents`（为了让表头与所有行共用一个网格），这种元素**没有自己的盒子**，
 * `getBoundingClientRect()` 量不到，所以拖拽落点按「招式名单元格」的底边来判定，不走 dnd-kit 的碰撞检测。
 */

/**
 * 指针落在第几行。
 * @param bottoms 各行命中区的下边界（`getBoundingClientRect().bottom`，按行顺序）
 * @param y 指针的 clientY
 * @returns 行下标；没有行时返回 -1
 */
export function rowIndexAtY(bottoms: readonly number[], y: number): number {
    if (bottoms.length === 0) return -1
    for (let i = 0; i < bottoms.length; i++) {
        if (y < bottoms[i]) return i
    }
    return bottoms.length - 1
}

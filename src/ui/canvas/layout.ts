/**
 * 战斗画面布局（纯函数，只算「画在哪」）—— 引擎的距离/射程/移动/判定一行未动。
 *
 * 两个约束：
 * 1. **最小间距**：两人逻辑位置很近（贴身、甚至同为 0）时，画面上不允许两具精灵完全重合。
 *    逻辑位置差不足 `MIN_CHAR_GAP_UNITS`（逻辑格）时，画面上的位置差按 `MIN_CHAR_GAP_UNITS` 算，
 *    且绕两人中点对称撑开——左者仍在左、右者仍在右，各挪一点，不打架。
 *    **位置差 ≥ 最小间距的档位逐档与从前完全一致**：只有贴身档被抬起来。
 * 2. **朝向按左右侧定**：左者朝右、右者朝左。不再按 x 大小比较推——位置相等时那种比较会把
 *    两人都判成「不在对方右边」，于是两人同朝向（用户报的 bug）。
 */

/**
 * 画面上两人的最小位置差（逻辑格）。
 *
 * 取值依据（实测，画布 400、最大精灵宽 180）：
 * - `pxPerUnit = (400 - 180) / viewUnits`，`viewUnits ≥ 8` → 27.5px/格。
 * - 实测对局里最小的一档是距离 0.1（位置差 0.1 格 ≈ 2.75px，画面几乎完全重合）。
 * - 距离 1 的一档（位置差 1.0 格 = 27.5px）已经能看出是两个人、且都朝对方。
 * - 取 1.5 格 ≈ 41px：比「相邻档」更紧（贴身确实是更近的那一档），又明显不同于完全重合。
 */
export const MIN_CHAR_GAP_UNITS = 1.5

/** 两人位置差不足最小间距时，绕中点对称撑开到最小间距（保持左右身份不变） */
export function enforceMinGap(a: number, b: number, minGap = MIN_CHAR_GAP_UNITS): [number, number] {
    if (!(Math.abs(b - a) < minGap)) return [a, b]
    const mid = (a + b) / 2
    const half = minGap / 2
    const dir = b >= a ? 1 : -1
    return [mid - dir * half, mid + dir * half]
}

/** 画面左侧那位的 id（位置小者；完全相等时取数组里先出现的，结果稳定不抖动） */
export function leftSideId(chars: readonly { id: string; pos: number }[]): string {
    if (chars.length === 0) return ''
    let left = chars[0]
    for (const c of chars) if (c.pos < left.pos) left = c
    return left.id
}

/** 朝向：左者朝右、右者朝左（与位置是否相等无关，所以贴身时也是「相对站立」） */
export function facesRight(id: string, leftId: string): boolean {
    return id === leftId
}

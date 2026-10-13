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
 * - 精灵**按内容居中之后**（见 `contentCenterShiftX`），画面位置差 == 两人的身体间距。
 * - 精灵美术的横向跨度实测 15 列 = **45px**（含头发/躯干；这是「身体」的实际宽度）。
 * - 取 **2.5 格 = 68.75px**：身体间距 = 68.75 − 45 = **23.75px 空隙**（肉眼明显是两个人，
 *   又还是「贴身」；再小就贴住了，再大会把 2.8 档也吞进来）。
 *   而**下一档 2.8 格 = 77.27px 仍 > 68.75px** → **单调性不破**（不会出现「越近反而越开」）。
 *   被合并成同一画面的只有 < 2.5 格那一段（本质都是贴身）。
 * - 实测对局里最小常用档是距离 0.1（0.1 格 ≈ 2.75px，画面几乎完全重合）、距离 0 时两人
 *   逻辑位置完全相等（0px）。这两档是这次要救的。
 *
 * 刻度尺（地面格线/数字）**保持按逻辑位置画** —— 它是玩家读距离的基准，跟着 clamp 等于骗人。
 * 代价是贴身时精灵离自己那道刻度最多约 1.25 格；贴身档短暂、附近又没有数字标注，实际看不出来。
 */
export const MIN_CHAR_GAP_UNITS = 2.5

/**
 * 精灵画布内「内容中心」相对画布中心的列偏移（朝右时为正 = 内容偏右）。
 *
 * 实测：朝右时身体内容占列 36..50 → 像素中心在列 43.5 处；渲染器按画布宽 w/2 = 30 列居中，
 * 于是内容中心比画布中心偏右 **13.5 列 = 40.5px**（PIXEL = 3）。朝左镜像后偏左同样的量。
 *
 * 为什么必须补偿：两个角色各偏 40.5px、方向相反，所以**改前**两人的身体间距是
 * `|centerGap − 81px|` 而不是 centerGap：
 * - 距离 0（centerGap = 0）时两具身体其实还相距 81px（看着正常）；
 * - centerGap = 81px 时（400px 画布 ≈ 距离 2.95；900px 画布 ≈ 距离 0.9，正是最常贴身的一段）
 *   两具身体**精确重合** —— 这才是「贴身看着像一个人 / 朝向一致」的真因，不是距离映射的问题；
 * - centerGap = 110px（距离 4）时又叠上 16px，所以「越远越开」也不成立。
 * 把精灵按内容居中（`contentCenterShiftX`）之后，身体间距 == centerGap，单调性才真正成立。
 * **将来不要再把偏心当成距离映射问题去改 clamp。**
 */
export const SPRITE_CONTENT_OFFSET_COLS = 13.5

/** 按内容居中：精灵左上角要额外平移的 x（px）。朝右减 40.5px、朝左加 40.5px（PIXEL = 3） */
export function contentCenterShiftX(facingRight: boolean, pixel: number): number {
    return (facingRight ? -SPRITE_CONTENT_OFFSET_COLS : SPRITE_CONTENT_OFFSET_COLS) * pixel
}

/** 朝右时身体内容中心的列号（内容占列 36..50） */
export const SPRITE_CONTENT_CENTER_COL = 43

/**
 * 身体内容中心的画面 x —— 用来断言「身体间距 == centerGap」。
 * 画布中心（渲染器按 `spriteWidthCols * pixel / 2` 居中）+ 内容偏心 + 居中补偿。
 * 补偿到位时后两项抵消（结果 == 画布中心）；补偿写反就会差 81px，断言立刻红。
 */
export function bodyCenterX(canvasLeftX: number, facingRight: boolean, spriteWidthCols: number, pixel: number): number {
    const col = facingRight ? SPRITE_CONTENT_CENTER_COL : spriteWidthCols - 1 - SPRITE_CONTENT_CENTER_COL
    return canvasLeftX + (col + 0.5) * pixel + contentCenterShiftX(facingRight, pixel)
}

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

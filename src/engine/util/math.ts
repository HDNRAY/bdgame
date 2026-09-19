/** 精确到小数点后1位 */
export function round1(v: number): number {
    return Math.round(v * 10) / 10
}

/**
 * 构造期属性转化的取整口径（`attrConvert`）：`round(from × ratio)`。
 *
 * 全局只此一个口径。`attrConvert` 曾经在类型上带 `mode?: 'round' | 'floor'`：两处显式写 floor、
 * 两处漏写走默认 round —— 同一条机制两种表现。现在统一成 round（四舍五入，对「×0.3／×0.25／×0.1」
 * 这类小额转化更符合「接近 1 点就算 1 点」的直觉），字段本身也删掉了，数据里无从再分叉。
 *
 * `inner_power_cost`（归元劲·内耗）也必须用它来算「转化出多少点」，否则会出现
 * 「按一种取整收 AP、按另一种取整给属性」的对不上账。
 */
export function convertAttrAmount(src: number, ratio: number): number {
    return Math.round(src * ratio)
}

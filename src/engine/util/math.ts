/** 精确到小数点后1位 */
export function round1(v: number): number {
    return Math.round(v * 10) / 10
}

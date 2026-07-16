import type { AttrName } from '../entities/attributes'

/** 培养点成本：≤13 = 1, 14~19 = 2, 20+ = 3 */
export function cultCost(value: number): number {
    if (value >= 20) return 3
    if (value >= 14) return 2
    return 1
}

/** 用 cultivation points 加点，按优先级顺序 */
export function spendCultPoints(
    start: Record<string, number>,
    points: number,
    priority: AttrName[],
): Record<string, number> {
    const result = { ...start }
    let remaining = points
    while (remaining > 0) {
        let improved = false
        for (const attr of priority) {
            if (result[attr] >= 30) continue
            const cost = cultCost(result[attr])
            if (remaining >= cost) {
                result[attr]++
                remaining -= cost
                improved = true
                break
            }
        }
        if (!improved) break
    }
    return result
}

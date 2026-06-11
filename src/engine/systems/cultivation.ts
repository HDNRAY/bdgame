import type { AttrName } from '../entities/attributes'

/** 培养点成本：≤13 = 1, 14+ = 2 */
export function cultCost(value: number): number {
    return value < 14 ? 1 : 2
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

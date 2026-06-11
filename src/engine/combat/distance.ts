/** 距离系统：0-10 档 */
export const DISTANCE_MIN = 0
export const DISTANCE_MAX = 10

export class DistanceSystem {
    current: number

    constructor(initial = 4) {
        this.current = Math.max(DISTANCE_MIN, Math.min(DISTANCE_MAX, initial))
    }

    /** 移动 delta 档（正=远离，负=靠近） */
    move(delta: number): number {
        const prev = this.current
        this.current = Math.max(DISTANCE_MIN, Math.min(DISTANCE_MAX, this.current + delta))
        return this.current - prev // 实际移动量
    }

    /** 目标是否在 [min, max] 范围内 */
    inRange(min: number, max: number): boolean {
        return this.current >= min && this.current <= max
    }

    /** 根据身法计算每点 AP 能移动的档位: dex / 20 */
    static apToRange(agility: number): number {
        return Math.max(0.5, agility / 20)
    }

    /** 计算移动：从 bestDistance（期望AP）算出实际消耗和位移量
     *  @param moveEff 移动效率倍率（1.2 = +20% 每AP移动距离）
     *  @param minMoveCost 最低移动消耗（固定 2 档/AP）
     */
    static calcMovement(
        bestDistance: number,
        agility: number,
        moveEff = 1,
        minMoveCost = false,
    ): { ap: number; delta: number } {
        const ap = Math.abs(bestDistance)
        const dir = Math.sign(bestDistance)
        const basePerAp = this.apToRange(agility)
        const perAp = minMoveCost ? 2 : basePerAp * moveEff
        return { ap, delta: dir * perAp * ap }
    }

    clone(): DistanceSystem {
        const d = new DistanceSystem(this.current)
        return d
    }
}

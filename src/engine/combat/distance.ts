/** 距离系统：0-6 档 */
export const DISTANCE_MIN = 0
export const DISTANCE_MAX = 6

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
    static apToRange(dexterity: number): number {
        return Math.max(0.5, dexterity / 20)
    }

    clone(): DistanceSystem {
        const d = new DistanceSystem(this.current)
        return d
    }
}

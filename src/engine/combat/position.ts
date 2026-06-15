/** 位置系统：大范围坐标，0 为中线 */
export const POS_MIN = -1000
export const POS_MAX = 1000

export class PositionSystem {
    private pos = new Map<string, number>()

    constructor(charA: string, posA: number, charB: string, posB: number) {
        this.pos.set(charA, clamp(posA))
        this.pos.set(charB, clamp(posB))
    }

    /** 获取角色位置 */
    get(charId: string): number {
        return this.pos.get(charId) ?? 0
    }

    /** 设置角色位置 */
    set(charId: string, value: number): void {
        this.pos.set(charId, clamp(value))
    }

    /** 两角色之间的距离（正数） */
    distance(a: string, b: string): number {
        return Math.abs(this.get(a) - this.get(b))
    }

    /** 移动角色 delta 格（正=向右，负=向左），返回实际位移 */
    move(charId: string, delta: number): number {
        if (!Number.isFinite(delta)) return 0
        const prev = this.get(charId)
        const next = clamp(prev + delta)
        this.pos.set(charId, next)
        return next - prev
    }

    /**
     * 朝目标方向移动指定距离。
     * 保持现有语义：正 delta = 远离，负 delta = 靠近
     */
    moveToward(selfId: string, targetId: string, delta: number): number {
        if (!Number.isFinite(delta)) return 0
        const selfPos = this.get(selfId)
        const targetPos = this.get(targetId)
        // delta < 0 = 靠近 = 朝目标方向移动
        // delta > 0 = 远离 = 背离目标方向移动
        const dir = selfPos < targetPos ? 1 : -1
        // 靠近(delta<0): 向目标移动 |delta| 格
        // 远离(delta>0): 背离目标移动 delta 格
        const moveDir = delta < 0 ? dir : -dir
        const amount = Math.abs(delta)
        return this.move(selfId, moveDir * amount)
    }

    /** 进攻方 self 是否在 [min, max] 范围内够到 target */
    inRange(selfId: string, targetId: string, min: number, max: number): boolean {
        const d = this.distance(selfId, targetId)
        return d >= min && d <= max
    }

    clone(): PositionSystem {
        const clone = new PositionSystem('', 0, '', 0)
        clone.pos = new Map(this.pos)
        return clone
    }

    /** 根据身法计算每点 AP 能移动的档位: agi / 20 */
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
        if (!Number.isFinite(bestDistance) || !Number.isFinite(agility)) return { ap: 0, delta: 0 }
        const ap = Math.abs(bestDistance)
        const dir = Math.sign(bestDistance)
        const basePerAp = this.apToRange(agility)
        const perAp = minMoveCost ? 2 : basePerAp * moveEff
        if (!Number.isFinite(perAp)) return { ap: 0, delta: 0 }
        return { ap, delta: dir * perAp * ap }
    }
}

function clamp(v: number): number {
    return Math.max(POS_MIN, Math.min(POS_MAX, v))
}

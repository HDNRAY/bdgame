/** 根据体质计算最大 HP */
export function calcMaxHp(vitality: number): number {
    return 60 + vitality * 16
}

/** 根据体质计算最大 AP */
export function calcMaxAp(vitality: number, mod = 0): number {
    return Math.round(4 + vitality * 0.25) + mod
}

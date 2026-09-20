/** 根据根骨计算最大 HP */
const MAX_HP_BASE = 100
const MAX_HP_PER_VIT = 15

/** 根据根骨计算最大 HP */
export function calcMaxHp(vitality: number): number {
    return MAX_HP_BASE + vitality * MAX_HP_PER_VIT
}

/** 根据根骨计算最大 AP */
const MAX_AP_BASE = 4
const MAX_AP_PER_VIT = 0.25

/** 根据根骨计算最大 AP */
export function calcMaxAp(vitality: number, mod = 0): number {
    return Math.round(MAX_AP_BASE + vitality * MAX_AP_PER_VIT) + mod
}

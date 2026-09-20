/** 根据根骨计算最大 HP */
const MAX_HP_BASE = 80
/**
 * 每点根骨的气血上限。**动态改根骨时要按它还原旧上限**（`applyAttrMods` 的血比例回填、
 * `applyAttrChangeSideEffects` 的旧上限估计），别再写死数字——历史上这里留过一次 18，
 * 系数改回 16 后那两处就成了静默偏差。
 */
export const MAX_HP_PER_VIT = 16

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

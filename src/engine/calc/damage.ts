import type { AttrName } from '../entities/attributes'

/** 基础前摇（所有角色统一） */
export const BASE_PRE_DELAY = 300
/** 基础硬直（所有角色统一） */
export const BASE_STUN_TIME = 350

/** 计算基础伤害: Σ(attrScaling[attr] × attrs[attr]) */
export function calcBaseDamage(scaling: Partial<Record<AttrName, number>>, attrs: Record<AttrName, number>): number {
    let damage = 0
    for (const [attr, scale] of Object.entries(scaling)) {
        damage += (scale ?? 0) * attrs[attr as AttrName]
    }
    return Math.round(damage * 10) / 10
}

/** 暴击判定: 基础 5% + technique / 200 */
export function calcCritChance(technique: number): number {
    return 0.05 + technique / 200
}

/** 最终伤害: base × distanceMult × (暴击? 1.5 : 1)，保留 1 位小数 */
export function calcFinalDamage(baseDamage: number, distanceMult: number, isCrit: boolean): number {
    let damage = Math.round(baseDamage * distanceMult * 10) / 10
    if (isCrit) damage = Math.round(damage * 1.5 * 10) / 10
    return Math.max(1, damage) // 至少 1 点
}

/** 命中判定: base 80% + (technique - 对方 dexterity) / 50 */
export function calcHitChance(myTechnique: number, enemyDexterity: number): number {
    return Math.max(0.1, Math.min(0.95, 0.8 + (myTechnique - enemyDexterity) / 50))
}

/** 招架判定: 有招架标签的武器才能招架，纯 strength / 80 */
export function calcParryChance(strength: number): number {
    return Math.min(0.5, strength / 80)
}

/** 闪避判定: dexterity / 80 */
export function calcDodgeChance(dexterity: number): number {
    return Math.min(0.4, dexterity / 80)
}

/** 移动消耗: 移动 1 档需要 AP = 1 / apToRange */
export function calcMoveApCost(distance: number, dexterity: number): number {
    const perAp = Math.max(0.5, dexterity / 20)
    return Math.ceil(distance / perAp)
}

/** 回合间隔: 基础 + 前后摇受身法影响(高dex大幅减少前后摇) */
export function calcTurnInterval(dexterity: number, extraPreDelay = 0, extraStunTime = 0): number {
    const base = 300 + 60000 / (100 + dexterity * 10)
    const dexFactor = Math.max(0, 1 - dexterity * 0.06)
    const epd = Math.round((BASE_PRE_DELAY + extraPreDelay) * dexFactor)
    const est = Math.round((BASE_STUN_TIME + extraStunTime) * dexFactor)
    return Math.round(base + epd + est)
}

/** 招架后伤害减免，默认减免至 40% */
export function calcParriedDamage(finalDamage: number, ratio = 0.4): number {
    return Math.round(finalDamage * ratio)
}

/** 崩劲：基于目标已损 HP 的额外伤害 */
export function calcCrippleBonus(missingHp: number, ratio: number): number {
    return Math.round(missingHp * ratio)
}

/** 自伤：基于自身最大 HP 的伤害 */
export function calcSelfDamage(maxHp: number, ratio: number): number {
    return Math.round(maxHp * ratio)
}

/** 考虑麻痹层数后的等效身法（用于闪避判定） */
export function calcDodgeChanceWithParalyze(dexterity: number, paralyzeStacks: number): number {
    const penalty = paralyzeStacks * 0.05
    const effectiveDex = dexterity - Math.floor(penalty * 10)
    return calcDodgeChance(Math.max(0, effectiveDex))
}

/** 麻痹到期时属性恢复量 */
export function calcParalyzeAttrRestore(stacks: number): { dexterity: number; insight: number } {
    return { dexterity: stacks * 2, insight: stacks * 1 }
}

/** 回复量：固定值 + 最大HP百分比 */
export function calcHealAmount(baseValue: number, maxHp: number, ratio?: number): number {
    return baseValue + (ratio ? Math.round(maxHp * ratio) : 0)
}

/** buff 时长：基于属性 × 系数 */
export function calcBuffDuration(baseAttr: number, multiplier: number): number {
    return Math.round(baseAttr * multiplier)
}

/** 毒间隔：基础 2000ms，每层 -200ms，最低 500ms */
export function calcPoisonTickInterval(stacks: number): number {
    return Math.max(500, 2000 - stacks * 200)
}

/** 掷骰：返回 roll 结果和是否成功 */
export function calcRoll(chance: number): { roll: number; success: boolean } {
    const roll = Math.random()
    return { roll, success: roll < chance }
}

/** 眩晕时长：每叠加一次减半（2000→1000→500→...） */
export function calcStunDuration(consecutive: number, baseDuration = 2000): number {
    return Math.round(baseDuration / Math.pow(2, consecutive - 1))
}

/** 麻痹施加时的属性惩罚 */
export function calcParalyzeAttrPenalty(stacks: number): { dexterity: number; insight: number } {
    return { dexterity: -stacks * 2, insight: -stacks * 1 }
}

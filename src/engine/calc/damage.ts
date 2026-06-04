import type { AttrName } from '../entities/attributes'

/** 基础前摇（所有角色统一） */
export const BASE_PRE_DELAY = 600
/** 基础硬直（所有角色统一） */
export const BASE_STUN_TIME = 700
/** 基础回合间隔（所有角色统一） */
export const BASE_TURN_INTERVAL = 1200

/** 计算基础伤害: Σ(attrScaling[attr] × attrs[attr]) */
export function calcBaseDamage(scaling: Partial<Record<AttrName, number>>, attrs: Record<AttrName, number>): number {
    let damage = 0
    for (const [attr, scale] of Object.entries(scaling)) {
        damage += (scale ?? 0) * attrs[attr as AttrName]
    }
    return Math.round(damage * 10) / 10
}

/** 暴击判定: 基础 5% + (dexterity + insight) / 200 */
export function calcCritChance(dexterity: number, insight: number): number {
    return 0.05 + (dexterity + insight) / 200
}

/** 最终伤害: base × distanceMult × (暴击? 1.5 : 1)，保留 1 位小数 */
export function calcFinalDamage(baseDamage: number, distanceMult: number, isCrit: boolean): number {
    let damage = Math.round(baseDamage * distanceMult * 10) / 10
    if (isCrit) damage = Math.round(damage * 1.5 * 10) / 10
    return Math.max(1, damage) // 至少 1 点
}

/** 命中判定: base 80% + (dexterity - 对方 agility) / 50 */
export function calcHitChance(myDexterity: number, enemyAgility: number): number {
    return Math.max(0.1, Math.min(0.95, 0.8 + (myDexterity - enemyAgility) / 50))
}

/** 招架判定: (身法 + 灵巧 + 洞察) / 120，上限 50% */
export function calcParryChance(agility: number, dexterity: number, insight: number): number {
    return Math.min(0.9, (agility + dexterity + insight) / 120)
}

/** 闪避判定: agility / 80 */
export function calcDodgeChance(agility: number): number {
    return Math.min(0.9, agility / 80)
}

/** 移动消耗: 移动 1 档需要 AP = 1 / apToRange */
export function calcMoveApCost(distance: number, agility: number): number {
    const perAp = Math.max(0.5, agility / 20)
    return Math.ceil(distance / perAp)
}

/** 回合间隔: 基础 + 前后摇受身法影响(高agi大幅减少前后摇) */
export function calcTurnInterval(agility: number, extraPreDelay = 0, extraStunTime = 0): number {
    const agiFactor = 0.4 + Math.max(0, 0.6 - agility * 0.02) // 每点身法减少0.2%，最高100%
    const base = BASE_TURN_INTERVAL
    const epd = Math.round(BASE_PRE_DELAY + extraPreDelay)
    const est = Math.round(BASE_STUN_TIME + extraStunTime)
    return Math.round((base + epd + est) * agiFactor)
}

/** 招架后伤害减免，默认减免至 40% */
/** 招架减免: 力道决定减免比例 (减免 20%-60%) */
export function calcParriedDamage(finalDamage: number, strength: number): number {
    const reduction = Math.min(0.6, Math.max(0.2, strength / 60))
    return Math.round(finalDamage * (1 - reduction) * 10) / 10
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
export function calcDodgeChanceWithParalyze(agility: number, paralyzeStacks: number): number {
    const penalty = paralyzeStacks * 0.05
    const effectiveAgi = agility - Math.floor(penalty * 10)
    return calcDodgeChance(Math.max(0, effectiveAgi))
}

/** 麻痹到期时恢复的身法/洞察 */
export function calcParalyzeAttrRestore(stacks: number): { agility: number; insight: number } {
    return { agility: stacks * 2, insight: stacks * 1 }
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
export function calcParalyzeAttrPenalty(stacks: number): { agility: number; insight: number } {
    return { agility: -stacks * 2, insight: -stacks * 1 }
}

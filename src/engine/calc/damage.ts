import type { AttrName } from '../entities/attributes'

/** 基础前摇（所有角色统一） */
export const BASE_PRE_DELAY = 600
/** 基础硬直（所有角色统一） */
export const BASE_STUN_TIME = 700
/** 基础回合间隔（所有角色统一） */
export const BASE_TURN_INTERVAL = 1200

/** VIT 缩短 debuff 持续时长：≤8 不减，20 点减 60% */
export function calcDebuffDuration(baseMs: number, vit: number): number {
    if (vit <= 8) return baseMs
    const ratio = Math.max(0.2, 1.4 - 0.05 * vit)
    return Math.round(baseMs * ratio)
}

/** 计算基础伤害: Σ(attrScaling[attr] × attrs[attr]) */
export function calcBaseDamage(
    scaling: Partial<Record<AttrName, number>>,
    attrs: Record<AttrName, number>,
    base = 0,
): number {
    let damage = base
    for (const [attr, scale] of Object.entries(scaling)) {
        damage += (scale ?? 0) * attrs[attr as AttrName]
    }
    return Math.round(damage * 10) / 10
}

/** 暴击判定: 基础 5% + (dexterity + insight) / 200 + critChanceMod */
export function calcCritChance(dexterity: number, insight: number, critChanceMod = 0): number {
    return Math.max(0.05, Math.min(0.95, 0.05 + (dexterity + insight) / 200 + critChanceMod))
}

/** 最终伤害: base × distanceMult × (暴击? (1.5 + critDamageMod) : 1) */
export function calcFinalDamage(baseDamage: number, distanceMult: number, isCrit: boolean, critDamageMod = 0): number {
    let damage = Math.round(baseDamage * distanceMult * 10) / 10
    if (isCrit) damage = Math.round(damage * (1.5 + critDamageMod) * 10) / 10
    return Math.max(1, damage)
}

/** 命中判定: 逻辑斯蒂曲线，自然收敛至 [0,1]，无需 clamp */
export function calcHitChance(opts: Record<string, number>): number {
    const atk = (opts.attackerDexterity ?? 0) / 80 + (opts.attackerInsight ?? 0) / 80
    const def = (opts.defenderAgility ?? 0) / 80 + (opts.defenderInsight ?? 0) / 80
    const dodgeMod = opts.defenderDodgeMod ?? 0
    const net = atk - def - dodgeMod
    // 逻辑斯蒂: net=0 → 80%, 陡度 k=7, 收敛
    const k = 7
    return 1 / (1 + Math.exp(-k * net - 1.386))
}

/** 招架判定: (灵巧 + 洞察) / 80，上限 90% */
export function calcParryChance(_agility: number, dexterity: number, insight: number): number {
    return Math.min(0.9, (dexterity + insight) / 80)
}

/** 移动消耗: 移动 1 档需要 AP = 1 / apToRange */
export function calcMoveApCost(distance: number, agility: number): number {
    const perAp = Math.max(0.5, agility / 20)
    return Math.ceil(distance / perAp)
}

/** 回合间隔: 基础 + 前后摇受身法影响（逻辑斯蒂曲线收敛，低身法不超过 3s） */
export function calcTurnInterval(agility: number, extraPreDelay = 0, extraStunTime = 0): number {
    // 逻辑斯蒂: 收敛至 [0.4, 1.28]，AGI=8→~2s, AGI=20→~1.14s（与原值一致）
    const agiFactor = 0.5 + 1.2 / (1 + Math.exp(agility * 0.2 - 1))
    const base = BASE_TURN_INTERVAL
    const epd = Math.round(BASE_PRE_DELAY + extraPreDelay)
    const est = Math.round(BASE_STUN_TIME + extraStunTime)
    return Math.round((base + epd + est) * agiFactor)
}

/** 召唤物回合间隔: 同人物逻辑，但用推演代替身法，衰减更平缓 */
export function calcSummonInterval(wisdom: number, extraPreDelay = 0, extraStunTime = 0): number {
    const wisFactor = 0.6 + Math.max(0, 0.4 - wisdom * 0.01)
    const base = BASE_TURN_INTERVAL
    const epd = Math.round(BASE_PRE_DELAY + extraPreDelay)
    const est = Math.round(BASE_STUN_TIME + extraStunTime)
    return Math.round((base + epd + est) * wisFactor)
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

// ── AP 回复 ──
/** 每推演每秒回复 AP 基数 */
export const AP_REGEN_BASE = 0.0625
/** 回复常数项 */
export const AP_REGEN_CONST = 0.75
/** 最低回复速度 (AP/s) */
export const AP_REGEN_MIN = 0.8

/** 每秒 AP 回复量 */
export function calcApRegenPerSec(wisdom: number): number {
    return Math.max(AP_REGEN_MIN, wisdom * AP_REGEN_BASE + AP_REGEN_CONST)
}

/** 给定毫秒回复多少 AP */
export function calcApRegen(ms: number, wisdom: number): number {
    return (ms / 1000) * calcApRegenPerSec(wisdom)
}

// ── 招式耗时 ──
/** 每点 AP 基础耗时 (秒) */
export const ACTION_TIME_BASE = 0.4
/** 最短耗时 (秒) */
export const ACTION_TIME_MIN = 0.15
/** 身法减免系数 */
export const ACTION_TIME_AGI_FACTOR = 0.02

/** 招式耗时 (毫秒) */
export function calcActionDurationMs(apCost: number, agility: number): number {
    const base = apCost * ACTION_TIME_BASE * 1000
    const agilityMult = 1 / (1 + agility * ACTION_TIME_AGI_FACTOR)
    return Math.round(Math.max(ACTION_TIME_MIN * 1000, base * agilityMult))
}

/** 麻痹到期时恢复的身法/灵巧 */
export function calcParalyzeAttrRestore(stacks: number): { agility: number; dexterity: number } {
    return { agility: stacks * 1, dexterity: stacks * 1 }
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

/** 每层毒的基础 tick 数：wisdom 越高消退越快 */
export function calcPoisonTicksPerStack(wisdom: number): number {
    return Math.max(4, Math.min(12, Math.round(12 - wisdom * 0.4)))
}

/** 掷骰：返回 roll 结果和是否成功 */
export function calcRoll(chance: number): { roll: number; success: boolean } {
    const roll = Math.random()
    return { roll, success: roll < chance }
}

/** 麻痹施加时的属性惩罚 */
export function calcParalyzeAttrPenalty(stacks: number): { agility: number; dexterity: number } {
    return { agility: -stacks * 1, dexterity: -stacks * 1 }
}

/** 眩晕属性保留比例：连续次数越高效果越弱 */
export function calcStunAttrRatio(consecutive: number): number {
    return 1 - 0.9 / Math.pow(2, consecutive - 1)
}

/** 眩晕属性差值：floor(原值×比例) 保底 1 */
export function calcStunAttrDelta(attrValue: number, ratio: number): number {
    return Math.max(1, Math.floor(attrValue * ratio)) - attrValue
}

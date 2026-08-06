import type { AttrName } from '../entities/attributes'
import { round1 } from '../util/math'

/** 基础前摇（所有角色统一） */
export const BASE_PRE_DELAY = 400
/** 基础硬直（所有角色统一） */
export const BASE_STUN_TIME = 500
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

/** 暴击判定: 基础 5% + (灵巧×1 + 洞察×1) / 200 + critChanceMod（灵巧:洞察 = 1:1） */
export function calcCritChance(dexterity: number, insight: number, critChanceMod = 0): number {
    return Math.max(0.05, Math.min(0.95, 0.05 + (dexterity + insight) / 200 + critChanceMod))
}

/** 最终伤害: base × distanceMult × (暴击? (1.5 + critDamageMod) : 1) */
export function calcFinalDamage(baseDamage: number, distanceMult: number, isCrit: boolean, critDamageMod = 0): number {
    let damage = Math.round(baseDamage * distanceMult * 10) / 10
    if (isCrit) damage = Math.round(damage * (1.5 + critDamageMod) * 10) / 10
    return Math.max(1, damage)
}

/** 命中判定: 逻辑斯蒂曲线，自然收敛至 [0,1]，无需 clamp
 *  攻击端：灵巧权重 1.2 > 洞察 1（灵巧为攻击主属性）；防御端身法/洞察均 1.0 */
export function calcHitChance(opts: Record<string, number>): number {
    const atk = ((opts.attackerDexterity ?? 0) + (opts.attackerInsight ?? 0) * 0.6) / 80
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

/** 前摇（毫秒）= (BASE_PRE_DELAY + extraPreDelay) × (1 - 身法/急速减免率) */
export function calcPreDelayMs(agility: number, extraPreDelay = 0, haste = 0): number {
    return Math.round((BASE_PRE_DELAY + extraPreDelay) * (1 - calcApCostReduction(agility, haste)))
}

/** 后摇（毫秒）= (BASE_STUN_TIME + extraStunTime) × (1 - 身法/急速减免率) */
export function calcStunMs(agility: number, extraStunTime = 0, haste = 0): number {
    return Math.round((BASE_STUN_TIME + extraStunTime) * (1 - calcApCostReduction(agility, haste)))
}

/** 召唤物回合间隔: 基础 + 前后摇，用推演代替身法（召唤物不吃身法/急速减免）
 *  推演收益削弱：每点由 1% → 0.5%（系数 0.01→0.005），防止高推演召唤流频率过快 */
export function calcSummonInterval(wisdom: number, extraPreDelay = 0, extraStunTime = 0, hasteMult = 1): number {
    const wisFactor = 0.6 + Math.max(0, 0.4 - wisdom * 0.005)
    const base = BASE_TURN_INTERVAL
    const epd = Math.round(BASE_PRE_DELAY + extraPreDelay)
    const est = Math.round(BASE_STUN_TIME + extraStunTime)
    // 御物加速：buff onSummonInterval 钩子返回前后摇乘数（<1=加速），保底 60% 防异常
    const mult = Math.max(0.6, hasteMult)
    return Math.round((base + (epd + est) * mult) * wisFactor)
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
/** 每推演每秒回复 AP 基数（0.1→0.05，压低推演对 AP 回复的支配力） */
export const AP_REGEN_BASE = 0.05
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
/** 原子回合最小行动间隔（毫秒）：回合未消耗 AP 时也保证有正延迟，防止同刻无限重入队 */
export const MIN_TURN_DELAY_MS = ACTION_TIME_MIN * 1000

/** 招式本身固有耗时 (毫秒)：纯 apCost 决定，不受身法/haste 影响 */
export function calcActionDurationMs(apCost: number): number {
    return Math.round(Math.max(ACTION_TIME_MIN * 1000, apCost * ACTION_TIME_BASE * 1000))
}

// ── 身法/急速 AP 消耗减免 ──
/** 每点身法（或每 10 点急速）的 AP 减免率 */
export const SPEED_AP_COST_RATE = 0.01
/** AP 减免率上限 */
export const SPEED_AP_COST_CAP = 0.4

/** 身法/急速对 AP 消耗的减免率（身法 1 点 = 1%，急速每 10 点 = 1%） */
export function calcApCostReduction(agility: number, haste: number): number {
    return Math.min(SPEED_AP_COST_CAP, (agility + haste / 10) * SPEED_AP_COST_RATE)
}

/** 减免后的招式 AP 成本（0 成本招式保持 0；非零成本最低 1；保留 1 位小数，让身法减免/百分比折扣真实生效） */
export function calcActionCostAfterSpeed(apCost: number, agility: number, haste: number): number {
    if (apCost <= 0) return 0
    return Math.max(1, round1(apCost * (1 - calcApCostReduction(agility, haste))))
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
    return Math.max(4, Math.min(10, Math.round((220 - 7 * wisdom) / 16)))
}

/** 流血伤害：floor(层数 × 1.5) */
export function calcBleedDamage(stacks: number): number {
    return Math.floor(stacks * 1.5)
}

/** 掷骰：返回 roll 结果和是否成功 */
export function calcRoll(chance: number): { roll: number; success: boolean } {
    const roll = Math.random()
    return { roll, success: roll < chance }
}

/** 眩晕属性保留比例：连续次数越高效果越弱 */
export function calcStunAttrRatio(consecutive: number): number {
    return 1 - 0.9 / Math.pow(2, consecutive - 1)
}

/** 眩晕属性差值：floor(原值×比例) 保底 1 */
export function calcStunAttrDelta(attrValue: number, ratio: number): number {
    return Math.max(1, Math.floor(attrValue * ratio)) - attrValue
}

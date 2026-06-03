import type { AttrName } from '../entities/attributes'

export type WeaponType = 'fist' | 'sword' | 'spear' | 'thrown' | 'control' | 'nanoblade' | 'katana'

export interface WeaponStats {
    attrScaling: Partial<Record<AttrName, number>>
    preDelay: number // 前摇 ms
    stunTime: number // 硬直 ms
    range: [number, number] // [min, max]
    parryRate?: number // 招架率加成
}

export const WEAPONS: Record<WeaponType, WeaponStats> = {
    fist: { attrScaling: { strength: 0.8 }, preDelay: 250, stunTime: 300, range: [0, 2], parryRate: 0.05 },
    sword: {
        attrScaling: { strength: 0.6, technique: 0.4 },
        preDelay: 350,
        stunTime: 400,
        range: [1, 3],
        parryRate: 0.08,
    },
    spear: { attrScaling: { strength: 1.0 }, preDelay: 450, stunTime: 500, range: [2, 4], parryRate: 0.03 },
    thrown: { attrScaling: { technique: 0.8 }, preDelay: 200, stunTime: 200, range: [2, 5], parryRate: 0 },
    control: { attrScaling: { wisdom: 1.0 }, preDelay: 400, stunTime: 350, range: [3, 6], parryRate: 0.02 },
    nanoblade: {
        attrScaling: { technique: 1.0, dexterity: 0.3 },
        preDelay: 300,
        stunTime: 350,
        range: [1, 3],
        parryRate: 0.06,
    },
    katana: {
        attrScaling: { strength: 0.7, technique: 0.5 },
        preDelay: 380,
        stunTime: 450,
        range: [1, 3],
        parryRate: 0.07,
    },
}

/** 计算基础伤害: Σ(attrScaling[attr] × attrs[attr]) */
export function calcBaseDamage(scaling: Partial<Record<AttrName, number>>, attrs: Record<AttrName, number>): number {
    let damage = 0
    for (const [attr, scale] of Object.entries(scaling)) {
        damage += (scale ?? 0) * attrs[attr as AttrName]
    }
    return Math.round(damage)
}

/** 距离衰减系数: 在最佳距离为 1.0，每偏离 1 档 -15% */
export function calcDistanceMultiplier(currentDist: number, bestDist: number): number {
    const diff = Math.abs(currentDist - bestDist)
    return Math.max(0.25, 1 - diff * 0.15)
}

/** 暴击判定: 基础 5% + technique / 200 */
export function calcCritChance(technique: number): number {
    return 0.05 + technique / 200
}

/** 最终伤害: base × distanceMult × (暴击? 1.5 : 1) */
export function calcFinalDamage(baseDamage: number, distanceMult: number, isCrit: boolean): number {
    let damage = Math.round(baseDamage * distanceMult)
    if (isCrit) damage = Math.round(damage * 1.5)
    return Math.max(1, damage) // 至少 1 点
}

/** 命中判定: base 80% + (technique - 对方 dexterity) / 50 */
export function calcHitChance(myTechnique: number, enemyDexterity: number): number {
    return Math.max(0.1, Math.min(0.95, 0.8 + (myTechnique - enemyDexterity) / 50))
}

/** 招架判定: 武器招架率 + strength / 100 */
export function calcParryChance(strength: number, weaponParryRate: number): number {
    return Math.min(0.5, weaponParryRate + strength / 100)
}

/** 闪避判定: dexterity / 100 */
export function calcDodgeChance(dexterity: number): number {
    return Math.min(0.4, dexterity / 100)
}

/** 移动消耗: 移动 1 档需要 AP = 1 / apToRange */
export function calcMoveApCost(distance: number, dexterity: number): number {
    const perAp = Math.max(0.5, dexterity / 20)
    return Math.ceil(distance / perAp)
}

/** 回合间隔: 基础 + 武器前摇/硬直受身法影响(高dex大幅减少前后摇) */
export function calcTurnInterval(dexterity: number, preDelay: number, stunTime: number): number {
    const base = 300 + 60000 / (100 + dexterity * 10)
    const dexFactor = Math.max(0, 1 - dexterity * 0.06)
    const epd = Math.round(preDelay * dexFactor)
    const est = Math.round(stunTime * dexFactor)
    return Math.round(base + epd + est)
}

/** 招架后伤害减免，默认减免至 40% */
export function calcParriedDamage(finalDamage: number, ratio = 0.4): number {
    return Math.round(finalDamage * ratio)
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

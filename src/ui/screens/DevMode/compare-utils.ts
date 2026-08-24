import type { EffectDef } from '../../../engine/entities/action'

/**
 * compare 工具（ActionCompare / WeaponCompare）共用的评分 util。
 * 暂时放这里，以后需要再挪公共层。
 */

/**
 * add_buff 评分：统一按「层数 × 概率」计。
 * add_buff 无 chance 字段（必叠，概率=1），故 = 层数。
 * 不做能力分类计价——所有 buff 一视同仁按层数，避免"伤害 buff vs 属性 buff"厚此薄彼。
 */
export function sumBuffScore(effects: EffectDef[] | undefined): number {
    if (!effects) return 0
    let total = 0
    for (const e of effects) {
        if (e.type !== 'add_buff') continue
        total += e.stacks ?? 1
    }
    return Math.round(total * 100) / 100
}

/** buff 评分口径说明（面板提示用） */
export const BUFF_SCORE_NOTE = 'buff（每层×1，按层数计）'

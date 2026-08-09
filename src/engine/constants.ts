/** 缠劲上限 */
export const MAX_CHAN = 50

/** AI 选招时把缠劲折算成 AP 的成本权重（1缠 = 权重×1AP）。
 *  只影响 AI 对招式的性价比判断（效率 = 伤害 / (AP + 缠×权重)），不改战斗结算。
 *  权重越大，AI 越少把高缠终结技当普通招乱放；但终结时仍会因伤害高而选用。
 *  实测校准（黛玄 vs 无志，一辉 vs 玉箫打平的权重）：非斩杀(敌55%)0.067、斩杀(敌30%)0.108 → 取 0.08。 */
export const AI_CHAN_COST_WEIGHT = 0.08

/** 汲取/汲灵 层数上限（超过则不再汲取） */
export const MAX_STAT_TRANSFER_LAYERS = 4

/** 每层毒每 tick 伤害 */
export const DMG_PER_POISON_TICK = 1

/** 缠劲上限 */
export const MAX_CHAN = 50

/** AI 选招时把缠劲折算成 AP 的成本权重（1缠 = 权重×1AP）。
 *  只影响 AI 对招式的性价比判断（效率 = 伤害 / (AP + 缠×权重)），不改战斗结算。
 *  权重越大，AI 越少把高缠终结技当普通招乱放；但终结时仍会因伤害高而选用。
 *  估值口径与 c5ap 同源（改一个数，AI 行为与脚本同步）。取 0.3：既不让 AI 乱放高缠招，也保留终结时倾泻的动机。 */
export const AI_CHAN_COST_WEIGHT = 0.3

/** 汲取/汲灵 层数上限（超过则不再汲取） */
export const MAX_STAT_TRANSFER_LAYERS = 4

/** 每层毒每 tick 伤害 */
export const DMG_PER_POISON_TICK = 1

/** 每 AP 移动距离的加性公式：MOVE_BASE + 身法 / MOVE_RATE。
 *  基础 0.4m 保证低身法也能移动；身法边际 0.025m/点（旧 max(0.5, agi/20) 的 1/20=0.05 减半）。 */
export const MOVE_BASE = 0.4
export const MOVE_RATE = 40

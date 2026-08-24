import { MAX_CHAN, AI_CHAN_COST_WEIGHT } from '../constants'

/**
 * 缠劲的 AP 机会成本（阈值感知模型）。
 *
 * 缠劲不是线性资源：30 是「周」buff 阈值（≥30 全属性+2），
 * 花缠跌破 30 会丢掉周加成 → 阈值附近的缠最值钱。
 *
 * 模型：
 *   - 基础权重随缠富余度递减（缠越满越便宜）：AI_CHAN_COST_WEIGHT × (1 - 富余度×0.675)
 *     （0.675 取前两版 0.85/0.5 的中间值）
 *   - 阈值惩罚：仅当「现有缠 ≥30 且花完跌破 30」才触发——丢周 buff 的持续收益折算成一次性 AP 成本；
 *     满缠（50）花少量缠不跌破 30 时无惩罚
 *
 * compare 工具（ActionCompare / WeaponCompare）与 AI 决策共用此函数，
 * 保证面板口径 = 引擎口径。
 */
export function calcChanCostInAp(chan: number, chanCost: number): number {
    if (chanCost <= 0) return 0
    const after = chan - chanCost
    // 仅跌破 30（丢周 Lv1 全属性+2）才惩罚：折算一次性约 2 AP
    const loseZhou = chan >= 30 && after < 30 ? 2 : 0
    const richness = Math.min(1, Math.max(0, chan / MAX_CHAN))
    const base = AI_CHAN_COST_WEIGHT * (1 - richness * 0.675)
    return chanCost * base + loseZhou
}

/** 供 AI：把角色当前缠劲折算成招式的缠 AP 成本 */
export function chanOpportunityCost(self: { chan: number }, chanCost: number): number {
    return calcChanCostInAp(self.chan, chanCost)
}

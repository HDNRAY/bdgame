/**
 * 一场战斗内的资源流水（内息 / 缠劲）—— `Character.res` 的类型。
 *
 * 每个数字都由 `Character` 的资源方法自己记账（`spendAp` / `gainAp` / `addChan` / `spendChan`），
 * 这是唯一权威口径：招式消耗、移动消耗、被打断扣气、武器/奇物自扣（如特种兵匕首 `spendChan(1)`）、
 * 时间回复、受击回气、上限溢出，全都经过这些方法，所以统计不必再去猜事件字段。
 * 战斗结束时由引擎一次性同步给 `BattleStats`（见 `docs/battle-stats-design.md`）。
 */
export interface ResourceTally {
    /** 主动消耗的内息（招式 / 移动 / 辅助招，含加成与减免后的实付） */
    apSpent: number
    /** 被外力扣掉的内息（打断、破气、御物耗炁这类净回复压制），不是自己花掉的 */
    apDrained: number
    /** 时间回复 + 效果回复的内息 */
    apGained: number
    /** 回复时因内息已满而浪费掉的部分 */
    apWasted: number
    /** 获得的缠劲（受击回气 / 每秒回复 / 效果给予） */
    chanGained: number
    /** 消耗的缠劲（招式、武器/奇物自扣、御物维持等） */
    chanSpent: number
    /** 缠劲满上限时被截断的溢出量 */
    chanOverflow: number
}

/** 空流水。每次调用都是新对象 —— 两场战斗（或沙盒与本体）绝不能共享同一份 */
export function emptyResourceTally(): ResourceTally {
    return {
        apSpent: 0,
        apDrained: 0,
        apGained: 0,
        apWasted: 0,
        chanGained: 0,
        chanSpent: 0,
        chanOverflow: 0,
    }
}

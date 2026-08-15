import type { RewardEntity } from './reward'
import type { RewardSpec } from './reward-spec'
import type { Effect } from './effect'
import type { When } from './condition'

// ════════════════════════════════════════
//  常量
// ════════════════════════════════════════

/** continue 类型 choice 的 id 为此值时，引擎结束当前事件，推进到下一节点。 */
export const END_EVENT = '__end__'

// ════════════════════════════════════════
//  Choice — 玩家在某轮中可以点的一个选项
// ════════════════════════════════════════

export interface Choice {
    /** 选项标识。
     *
     *  含义取决于 type：
     *  - event            : 事件 ID，引擎开始该事件。
     *  - weapon/action/passive/artifact : 实体 ID，引擎给奖励。
     *  - continue         : 目标轮次 ID，引擎跳转。值为 END_EVENT 时结束事件。
     *  - points/heal      : 固定为 'points' / 'heal'。 */
    id: string

    /** 选项类型。引擎据此决定处理逻辑。
     *
     *  - 'event'     : 开始该事件。
     *  - 'weapon'    : 给武器奖励，结束事件，推进到下一节点。
     *  - 'action'    : 给招式奖励，结束事件，推进到下一节点。
     *  - 'passive'   : 给功法奖励，结束事件，推进到下一节点。
     *  - 'artifact'  : 给奇物奖励，结束事件，推进到下一节点。
     *  - 'points'    : 加修炼点（计入 16 次预算），结束事件，推进到下一节点。
     *  - 'heal'      : 恢复伤势，结束事件，推进到下一节点。
     *  - 'continue'  : 推进到 id 对应轮次。id === END_EVENT 时结束事件。 */
    type: 'event' | 'weapon' | 'action' | 'passive' | 'artifact' | 'points' | 'heal' | 'continue'

    /** 展示文字。纯文本，不含 emoji。 */
    label: string

    /** 补充说明。选填。 */
    description?: string

    /** 选择后执行的效果（写 flag / 给奖励 / 加点…），替代旧 setFlags 与一切引擎特判。 */
    effects?: Effect[]

    /** 武器奖励挂载槽位（默认主手；副手奖励用）。 */
    slot?: 'main' | 'offhand'

    /** 选项出现条件（flag 表达式）：不满足则该选项不显示。 */
    when?: When
}

// ════════════════════════════════════════
//  Round — 一轮交互
// ════════════════════════════════════════

export interface Round {
    /** 轮次 ID。continue 选择用此值做跳转目标。 */
    id: string

    /** 本轮标题。 */
    title: string

    /** 本轮说明文本。 */
    description?: string

    /** 战斗结算（有值代表已打完）。 */
    result?: {
        won: boolean
        injuryGained: number
        log?: string[]
    }

    /** 本轮的选项。至少 1 项。 */
    choices: Choice[]

    /** 固定敌人 ID。有值→战斗轮，引擎自动执行战斗。 */
    enemyId?: string

    /** 随机敌人池（enemyId 缺省时从池中随机挑一个）。通用 Boss 用此表达"未指定则随机"。 */
    enemyPool?: string[]

    /** Boss 剧情名。覆盖敌人默认名字。 */
    bossName?: string

    /** 轮次级奖励规格（覆盖事件级 reward）。 */
    reward?: RewardSpec

    /** 轮次级奖励过滤器。 */
    rewardFilter?: (item: RewardEntity) => boolean
}

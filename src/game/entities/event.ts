import type { Round } from './round'
import type { RewardSpec } from './reward-spec'
import type { Effect } from './effect'
import type { Placement } from './node-spec'

// ════════════════════════════════════════
//  事件定义（统一：放置 + 效果 + 奖励 + 轮次）
//  全部可序列化，无函数钩子。
// ════════════════════════════════════════

export interface EventDef {
    id: string
    name: string
    description?: string
    /** 该事件出现在哪些节点（可多处、带条件、带权重）。缺省 = 只被其他事件引用（如出身事件）。 */
    placement?: Placement[]
    /** 事件开始即执行的效果（写 flag / 给奖励 / 加点…）。 */
    effects?: Effect[]
    /** 奖励规格（默认奖励；轮次级可用 round.reward 覆盖）。 */
    reward?: RewardSpec
    rounds: Round[]
}

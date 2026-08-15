import type { Round } from './round'
import type { RewardType, RewardEntity } from './reward'
import type { GameState } from './state'

// ════════════════════════════════════════
//  事件定义（新系统）
//  事件是统一的：一个 ID，一个名称，一个奖励类型，以及可选的轮次序列。
//  引擎根据 rewardType 自动生成轮次，或使用 rounds 自定义轮次。
// ════════════════════════════════════════

export interface EventDef {
    id: string
    name: string
    description?: string
    rewardType: RewardType
    rewardFilter?: (item: RewardEntity) => boolean
    rounds: Round[]
    /** 条件检测：返回 false 则该事件不会出现在 fillEmptyNodes 中。 */
    available?: (state: GameState) => boolean
    /** 无奖励事件（如淘汰赛）。true 时引擎不生成奖励轮，直接给「继续」选项。 */
    noReward?: boolean
}

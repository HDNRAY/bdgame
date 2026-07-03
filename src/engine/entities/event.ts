import type { Round } from './round'
import type { RewardType } from './reward'

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
    rounds: Round[]
}

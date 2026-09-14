import type { GameEntity } from '../../engine/entities/base'
import type { ActionDefinition } from '../../engine/entities/action'
import type { Passive } from '../../engine/entities/passive'
import type { Artifact } from '../../engine/entities/artifact'
import type { WeaponDef } from '../../data/weapons/weapons'

/** 节点奖励类型 */
export type RewardType = 'weapon' | 'action' | 'passive' | 'artifact' | 'points'

/** 统一奖励接口（简化版，用于 CharacterBuild.rewards 存储） */
export interface Reward extends GameEntity {
    type: RewardType
}

/** 奖励池中的实体（完整定义，含 apCost 等字段） */
export type RewardEntity = ActionDefinition | WeaponDef | Passive | Artifact

export const CULT_REWARD = {
    id: 'cult_reward',
    name: '修炼点',
    label: '修炼点',
    description: '+4 修炼点',
    log: '+4 修炼点',
    points: 4,
} as const

/** 全局修炼点奖励上限：整局最多给 16 次 +4 修炼点（含 n1 开局、选空手等）。 */
export const MAX_POINTS_REWARDS = 16

/**
 * 一局里实体奖励的槽位数（武器/招式/功法/奇物）。
 * 整局奖励机会共 29 次 = 16 次修炼点 + 13 个实体奖励，无论哪条故事线都一样。
 * 初始武器（空手）不算奖励；n1 的出身后奖励（4 点修炼点，或天生道种那条线的奇物）算在账本内。
 */
export const ENTITY_REWARD_SLOTS = 13

/** 一局奖励槽总数（修炼点 + 实体）。配额按这个账本发放，发满即止。 */
export const TOTAL_REWARD_SLOTS = MAX_POINTS_REWARDS + ENTITY_REWARD_SLOTS

import type { GameEntity } from '../../engine/entities/base'
import type { AttrName } from '../../engine/entities/attributes'
import type { ActionDefinition } from '../../engine/entities/action'
import type { Passive } from '../../engine/entities/passive'
import type { Artifact } from '../../engine/entities/artifact'
import type { WeaponDef } from '../../data/weapons/weapons'

/** 节点奖励类型 */
export type RewardType = 'weapon' | 'action' | 'passive' | 'artifact' | 'points' | 'heal'

/** 统一奖励接口（简化版，用于 CharacterBuild.rewards 存储） */
export interface Reward extends GameEntity {
    type: RewardType
}

/** 奖励池中的实体（完整定义，含 apCost 等字段） */
export type RewardEntity = ActionDefinition | WeaponDef | Passive | Artifact

export const STAT_NAMES: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

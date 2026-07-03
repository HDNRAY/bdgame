import type { GameEntity } from './base'
import type { AttrName } from './attributes'
import type { ActionDefinition } from './action'
import type { Passive } from './passive'
import type { Artifact } from './artifact'
import type { WeaponDef } from '../data/weapons/weapons'

/** 节点奖励类型 */
export type RewardType = 'weapon' | 'action' | 'passive' | 'artifact' | 'points' | 'heal'

/** 统一奖励接口（简化版，用于 CharacterBuild.rewards 存储） */
export interface Reward extends GameEntity {
    type: RewardType
}

/** 奖励池中的实体（完整定义，含 apCost 等字段） */
export type RewardEntity = ActionDefinition | WeaponDef | Passive | Artifact

export const STAT_NAMES: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

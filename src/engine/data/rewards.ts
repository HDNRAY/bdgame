import type { GameEntity } from '../entities/base'
import type { AttrName } from '../entities/attributes'

/** 节点奖励类型 */
export type RewardType = 'cult' | 'passive' | 'artifact' | 'action' | 'weapon'

export interface Reward extends GameEntity {
    type: RewardType
}

export const STAT_NAMES: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

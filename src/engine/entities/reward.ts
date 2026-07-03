import type { GameEntity } from './base'
import type { AttrName } from './attributes'

/** 节点奖励类型 */
export type RewardType = 'weapon' | 'action' | 'passive' | 'artifact' | 'points' | 'heal'

/** 统一奖励接口 */
export interface Reward extends GameEntity {
    type: RewardType
}

export const STAT_NAMES: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

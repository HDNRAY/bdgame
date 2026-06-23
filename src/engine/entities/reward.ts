import type { GameEntity } from './base'
import type { AttrName } from './attributes'

/** 节点奖励类型 */
export type RewardType = 'cult' | 'passive' | 'artifact' | 'action' | 'weapon'

/** 可展示可选择的奖励物品类型（cult 不在此列） */
export type ItemRewardType = 'passive' | 'artifact' | 'action' | 'weapon'

/** 统一奖励接口 */
export interface Reward extends GameEntity {
    type: RewardType
}

export const STAT_NAMES: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

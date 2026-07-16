import { rewardPool } from './reward-pool'
import { pickWeightedByTags } from '../tagRelevance'
import type { Choice } from '../../game/entities/round'
import type { RewardEntity, RewardType } from '../../game/entities/reward'
import type { Tag } from '../../engine/entities/tag'

export function generateRewardChoices(
    rewardType: RewardType,
    playerTags: Tag[] = [],
    filter?: (reward: RewardEntity) => boolean,
    pool?: RewardEntity[],
): Choice[] {
    if (rewardType === 'points') {
        return [{ id: 'cult_reward', type: 'points', label: '修炼点', description: '+4 修炼点' }]
    }
    if (rewardType === 'heal') {
        return [{ id: 'heal_reward', type: 'heal', label: '疗伤', description: '恢复 15 伤势' }]
    }

    const source = pool ?? rewardPool.getPool(rewardType)
    const items = filter ? source.filter(filter) : [...source]

    const picked = pickWeightedByTags(items, playerTags, 3)
    return picked.map((i: RewardEntity) => ({
        id: i.id,
        type: rewardType,
        label: i.name,
        description: i.description,
    }))
}

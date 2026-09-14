import { rewardPool } from './reward-pool'
import { pickWeightedByTags } from '../tagRelevance'
import { CULT_REWARD } from '../entities/reward'
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
        return [{ id: CULT_REWARD.id, type: 'points', label: CULT_REWARD.label, description: CULT_REWARD.description }]
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

import { rewardPool } from './reward-pool'
import { pickWeightedByTags } from '../tagRelevance'
import type { Choice } from '../../entities/round'
import type { Reward, RewardType } from '../../entities/reward'
import type { Tag } from '../../entities/tag'

/**
 * 根据奖励类型生成选择项。
 *
 * @param rewardType - 奖励类型
 * @param playerTags - 玩家 tags（用于加权随机）
 * @param filter - 统一过滤函数。返回 true 才保留。
 *                 调用方在此处理 exclude、flag 解锁等所有过滤逻辑。
 */
export function generateRewardChoices(
    rewardType: RewardType,
    playerTags: Tag[] = [],
    filter?: (reward: Reward) => boolean,
): Choice[] {
    if (rewardType === 'points') {
        return [{ id: 'cult_reward', type: 'points', label: '修炼点', description: '+4 修炼点' }]
    }
    if (rewardType === 'heal') {
        return [{ id: 'heal_reward', type: 'heal', label: '疗伤', description: '恢复 15 伤势' }]
    }

    const pool = rewardPool.getPool(rewardType)
    const items = filter ? pool.filter(filter) : [...pool]

    // 加权随机取 3 个
    const picked = pickWeightedByTags(items, playerTags, 3)
    return picked.map((i: Reward) => ({
        id: i.id,
        type: rewardType,
        label: i.name,
        description: i.description,
    }))
}

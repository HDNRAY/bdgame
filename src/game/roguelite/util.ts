import type { RewardEntity } from '../../engine/entities/reward'

/** 从数组中随机取 n 个不重复的元素 */
export function pickRandom<T>(arr: T[], n: number): T[] {
    const copy = [...arr]
    const result: T[] = []
    for (let i = 0; i < n && copy.length > 0; i++) {
        const idx = Math.floor(Math.random() * copy.length)
        result.push(copy[idx])
        copy.splice(idx, 1)
    }
    return result
}

/**
 * rewardFilter：仅保留基础招式。
 * 招式池中的非基础招式（pre_action / post_action、apCost > 2）不显示。
 */
export function isBasicAction(item: RewardEntity): boolean {
    if (!('apCost' in item)) return false
    return item.apCost <= 2 && !item.tags?.includes('pre_action') && !item.tags?.includes('post_action')
}

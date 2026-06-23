import type { CharacterBuild } from '../entities/character-build'
import type { Reward } from '../entities/reward'
import type { ActionConfig } from '../entities/action-config'
import { STAT_NAMES } from '../entities/reward'
import { cultCost } from './cultivation'
import { checkTalents } from './talent-check'
import { generateOpponent as rawGen } from '../data/opponents/index'

/** 通用生成器 */
export function simpleGenerate(
    id: string,
    name: string,
    background: string,
    weapon: string,
    targetAttrs: Record<string, number>,
    rewards: Reward[],
    n: number,
    /** +4 修炼点奖励次数（默认每2节点1次），修炼点 = cultRewards × 4 */
    cultRewards = Math.floor((n - 1) / 2),
    /** 额外修炼点（背景加成等） */
    extraPoints = 0,
    actionConfigs?: ActionConfig[],
): CharacterBuild {
    // 总修炼点 = cultRewards × 4 + extraPoints
    const total = Math.max(0, cultRewards * 4 + extraPoints)
    const result: Record<string, number> = {}
    for (const a of STAT_NAMES) result[a] = 3

    // 轮流加点：循环各属性，每次只加1点，不超过 targetAttrs 上限
    let remaining = total
    while (remaining > 0) {
        let improved = false
        for (const attr of STAT_NAMES) {
            const cur = result[attr]
            const target = targetAttrs[attr] ?? 30
            if (cur >= target) continue
            const cost = cultCost(cur)
            if (remaining >= cost) {
                result[attr]++
                remaining -= cost
                improved = true
            }
        }
        if (!improved) break
    }

    // 根据属性自动解锁天赋
    const talentRewards = checkTalents(result)

    // 奖励按优先级选取
    const ratio = Math.min(1, n / 33)
    const rewardCount = Math.round(rewards.length * ratio)
    const picked = rewards.slice(0, rewardCount)

    return {
        id,
        name,
        background,
        weapon,
        spriteId: id,
        baseAttrs: result,
        rewards: [...talentRewards, ...picked],
        actionConfigs,
    }
}

/** 随机生成一个对手的 build */
export function generateOpponent(n: number): CharacterBuild {
    const { build } = rawGen(n)
    return build
}

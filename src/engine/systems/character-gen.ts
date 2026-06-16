import type { CharacterBuild } from '../entities/character-build'
import type { Reward } from '../data/rewards'
import type { TriggerSlot } from '../entities/trigger'
import { STAT_NAMES } from '../data/rewards'
import { cultCost } from './cultivation'
import { checkTalents } from './talent-check'
import { generateOpponent as rawGen } from '../data/opponents/index'

/** 通用生成器：按目标值精确分配 cultivation points */
export function simpleGenerate(
    id: string,
    name: string,
    background: string,
    weapon: string,
    targetAttrs: Record<string, number>,
    rewards: Reward[],
    triggers: TriggerSlot[],
    n: number,
    extraPoints = 0,
): CharacterBuild {
    // n 代表这是第几个节点，说明前面有 n - 1 个节点的奖励修炼点
    const total = (n - 1) * 2 + extraPoints
    const result: Record<string, number> = {}
    for (const a of STAT_NAMES) result[a] = 3

    // 先加便宜的，再加贵的
    let remaining = total
    for (const maxCost of [1, 2, 3]) {
        let dirty = true
        while (dirty) {
            dirty = false
            for (const attr of STAT_NAMES) {
                const cur = result[attr]
                const target = targetAttrs[attr] ?? 30
                if (cur >= target) continue
                const cost = cultCost(cur)
                if (cost > maxCost) continue
                if (remaining < cost) continue
                result[attr]++
                remaining -= cost
                dirty = true
            }
        }
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
        triggers,
    }
}

/** 随机生成一个对手的 build */
export function generateOpponent(n: number): CharacterBuild {
    const { build } = rawGen(n)
    return build
}

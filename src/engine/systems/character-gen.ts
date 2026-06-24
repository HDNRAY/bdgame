import type { CharacterBuild } from '../entities/character-build'
import type { Reward } from '../entities/reward'
import type { ActionConfig } from '../entities/action-config'
import { STAT_NAMES } from '../entities/reward'
import { cultCost } from './cultivation'
import { checkTalents } from './talent-check'

/** 初始武器猜测（先用 bare_hands，后续按 tag 细化） */
function guessWeapon(_signature: string): string {
    return 'bare_hands'
}

/** 通用生成器 */
export function simpleGenerate(
    def: { id: string; name: string; battleStyle: string; story?: string; targetAttrs: Record<string, number> },
    weapon: string,
    rewards: Reward[],
    n: number,
    actionConfigs?: ActionConfig[],
): CharacterBuild {
    // 修炼点 = 每2节点1次+4
    const cultRewards = Math.floor((n - 1) / 2)
    // 天生道种：每4节点多1次+4修炼点
    const hasInnateSeed = rewards.some((r) => r.id === 'innate_seed')
    const extraPoints = hasInnateSeed ? Math.floor((n - 1) / 4) * 4 : 0
    const total = Math.max(0, cultRewards * 4 + extraPoints)
    const result: Record<string, number> = {}
    for (const a of STAT_NAMES) result[a] = 3

    // 轮流加点
    let remaining = total
    while (remaining > 0) {
        let improved = false
        for (const attr of STAT_NAMES) {
            const cur = result[attr]
            const target = def.targetAttrs[attr] ?? 30
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

    // 只保留已解锁招式对应的 actionConfigs
    const pickedActionIds = new Set(picked.filter((r) => r.type === 'action').map((r) => r.id))
    const filteredConfigs = actionConfigs?.filter((ac) => pickedActionIds.has(ac.actionId))

    return {
        id: def.id,
        name: def.name,
        story: def.story,
        battleStyle: def.battleStyle,
        weapon: guessWeapon(weapon),
        spriteId: def.id,
        baseAttrs: result,
        rewards: [...talentRewards, ...picked],
        actionConfigs: filteredConfigs,
    }
}

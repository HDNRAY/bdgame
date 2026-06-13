import type { CharacterBuild } from '../../entities/character-build'
import type { BattleState, ActionCommand } from '../../combat/types'
import type { Character } from '../../entities/character'
import type { Reward } from '../rewards'
import type { TriggerSlot } from '../../entities/trigger'
import { getBackground } from '../backgrounds'
import { STAT_NAMES } from '../rewards'
import { cultCost } from '../../systems/cultivation'

/** 对手定义 */
export interface OpponentDef {
    id: string
    name: string
    /** 根据 n 返回对应强度的 build */
    generate: (n: number) => CharacterBuild
    /** 自定义 AI（返回 null = 用默认） */
    planEvent?: (self: Character, state: BattleState) => ActionCommand[] | null
}

/** 奖励快捷函数 */
export const passive = (id: string): Reward => ({ type: 'passive', id, name: id, description: '', tags: [] })
export const artifact = (id: string): Reward => ({ type: 'artifact', id, name: id, description: '', tags: [] })
export const action = (id: string): Reward => ({ type: 'action', id, name: id, description: '', tags: [] })

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
): CharacterBuild {
    const bg = getBackground(background)
    const bgAttrs: Record<string, number> = {}
    for (const a of STAT_NAMES) bgAttrs[a] = bg?.attrs[a] ?? 3

    const cultPoints = n * 2 // 每轮 2 点，33 轮 = 66 点
    const prio = [...STAT_NAMES].sort((a, b) => (targetAttrs[b] ?? 0) - (targetAttrs[a] ?? 0))

    // 按优先级加点至目标值
    const result = { ...bgAttrs }
    let remaining = cultPoints
    while (remaining > 0) {
        let improved = false
        for (const attr of prio) {
            const target = targetAttrs[attr] ?? 30
            if (result[attr] >= target) continue
            const cost = cultCost(result[attr])
            if (remaining >= cost) {
                result[attr]++
                remaining -= cost
                improved = true
                break
            }
        }
        if (!improved) break
    }

    const ratio = Math.min(1, n / 33)
    const rewardCount = Math.round(rewards.length * ratio)
    const shuffled = [...rewards].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, rewardCount)

    return {
        id,
        name,
        background,
        weapon,
        baseAttrs: result,
        rewards: picked,
        triggers,
    }
}

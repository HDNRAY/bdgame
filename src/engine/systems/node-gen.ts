import { BACKGROUNDS } from '../data/backgrounds'
import type { CharacterBuild } from '../entities/character-build'
import { REWARD_POOL, STAT_NAMES, STARTING_WEAPONS } from '../data/rewards'
import type { Reward } from '../data/rewards'
import type { AttrName } from '../entities/attributes'
import { spendCultPoints } from './cultivation'

/** 节点探索结果 */
export interface NodeRunResult {
    build: CharacterBuild
    logs: string[]
}

/** 洗牌 */
export function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

/** 从奖励池取 n 个不同非属性奖励 */
export function pickNonStatRewards(n: number, pool: Reward[], poolIdx: { current: number }): Reward[] {
    const choices: Reward[] = []
    const seen = new Set<string>()
    while (choices.length < n && poolIdx.current < pool.length * 10) {
        const r = pool[poolIdx.current % pool.length]
        poolIdx.current++
        if (r.type !== 'stat' && !seen.has(r.id)) {
            seen.add(r.id)
            choices.push(r)
        }
    }
    return choices
}

/** 运行完整节点探索，返回 build */
export function runNodeExploration(bgIndex: number, weaponIndex: number, n: number): NodeRunResult {
    const logs: string[] = []
    const bg = BACKGROUNDS[bgIndex]
    logs.push(`背景: ${bg.name}`)

    const weaponId = STARTING_WEAPONS[weaponIndex]
    const bgAttrs: Record<string, number> = { ...bg.attrs }
    for (const a of STAT_NAMES) bgAttrs[a] ??= 3

    // 培养点自动分配：每节点 2 点，按 stat 名称循环做优先级（模拟玩家手动选）
    // 实际手动模式会让玩家自由分配，这里用 round-robin 模拟
    const priority: AttrName[] = [...STAT_NAMES]
    const totalPoints = n * 2
    const finalAttrs = spendCultPoints(bgAttrs, totalPoints, priority)

    // 每节点 1 个非属性奖励
    const rewards: Reward[] = []
    const shuffledPool = shuffle(REWARD_POOL.filter((r) => r.type !== 'stat'))
    const poolIdx = { current: 0 }
    const picked = new Set<string>()

    for (let round = 0; round < n; round++) {
        const choices = pickNonStatRewards(3, shuffledPool, poolIdx)
        const pick = choices.find((c) => !picked.has(c.id)) ?? choices[0]
        if (pick) {
            picked.add(pick.id)
            rewards.push(pick)
            logs.push(`节点 ${round + 1}: ${pick.type}「${pick.name}」`)
        }
    }

    const build: CharacterBuild = {
        id: 'player',
        name: '挑战者',
        background: bg.id,
        weapon: weaponId,
        baseAttrs: finalAttrs,
        rewards,
        triggers: [],
    }

    return { build, logs }
}

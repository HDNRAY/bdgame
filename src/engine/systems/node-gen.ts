import { BACKGROUNDS } from '../data/backgrounds'
import type { CharacterBuild } from '../entities/character-build'
import { REWARD_POOL, STAT_NAMES, STARTING_WEAPONS } from '../data/rewards'
import type { Reward } from '../data/rewards'

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

/** 从奖励池取 n 个不同奖励 */
export function pickRewards(n: number, forceStat: boolean, pool: Reward[], poolIdx: { current: number }): Reward[] {
    const choices: Reward[] = []
    const seen = new Set<string>()
    while (choices.length < n && poolIdx.current < pool.length * 10) {
        const r = pool[poolIdx.current % pool.length]
        poolIdx.current++
        if (!seen.has(r.id) && (!forceStat || choices.length > 0 || r.type === 'stat')) {
            seen.add(r.id)
            choices.push(r)
        }
    }
    if (forceStat && !choices.some((c) => c.type === 'stat')) {
        choices[choices.length - 1] = {
            type: 'stat',
            id: STAT_NAMES[poolIdx.current % 6],
            name: `${STAT_NAMES[poolIdx.current % 6]} +2`,
            description: `${STAT_NAMES[poolIdx.current % 6]} +2`,
            tags: [],
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
    logs.push(`武器: ${weaponId}`)

    const attrs: Record<string, number> = { ...bg.attrs }
    const gainedActions: string[] = []
    const gainedPassives: string[] = []
    const gainedArtifacts: string[] = []

    const shuffledPool = shuffle(REWARD_POOL)
    const poolIdx = { current: 0 }
    const picked = new Set<string>() // 去重

    for (let round = 0; round < n; round++) {
        const forceStat = round % 2 === 0
        const choices = pickRewards(3, forceStat, shuffledPool, poolIdx)

        // auto-pick: stat > passive > implant > action，且不重复
        const pick =
            choices
                .filter((c) => c.type === 'stat' || !picked.has(c.id))
                .sort((a, b) => {
                    const rank = { stat: 0, passive: 1, implant: 2, action: 3 }
                    return rank[a.type] - rank[b.type]
                })[0] ?? choices[0]

        picked.add(pick.id)

        if (pick.type === 'stat') {
            attrs[pick.id] = (attrs[pick.id] ?? 3) + 2
            logs.push(`节点 ${round + 1}: ${pick.name}`)
        } else if (pick.type === 'passive') {
            gainedPassives.push(pick.id)
            logs.push(`节点 ${round + 1}: 功法「${pick.name}」`)
        } else if (pick.type === 'implant') {
            gainedArtifacts.push(pick.id)
            logs.push(`节点 ${round + 1}: 义体「${pick.name}」`)
        } else if (pick.type === 'action') {
            gainedActions.push(pick.id)
            logs.push(`节点 ${round + 1}: 招式「${pick.name}」`)
        }
    }

    // 没拿到任何招式时给个默认的
    const finalActions = gainedActions.length > 0 ? gainedActions : ['jab']

    attrs.strength ??= 3
    attrs.vitality ??= 3
    attrs.agility ??= 3
    attrs.dexterity ??= 3
    attrs.insight ??= 3
    attrs.wisdom ??= 3

    const build: CharacterBuild = {
        id: 'player',
        name: '挑战者',
        weapon: weaponId,
        baseAttrs: attrs,
        actions: finalActions,
        triggers: [],
        passives: gainedPassives,
        artifacts: gainedArtifacts,
    }

    return { build, logs }
}

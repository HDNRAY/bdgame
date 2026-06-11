import { type OpponentDef } from './base'
import type { Reward } from '../rewards'
import type { TriggerSlot } from '../../entities/trigger'
import { getBackground } from '../backgrounds'
import { STAT_NAMES } from '../rewards'
import { cultCost } from '../../systems/cultivation'

const POOL = ['iaijutsu_strike', 'slash', 'foresight', 'resheath', 'empty_hand', 'tiger_eye']

function rewardType(id: string): 'passive' | 'implant' | 'action' {
    if (id === 'iaijutsu_mastery' || id === 'empty_hand') return 'passive'
    if (id === 'tiger_eye') return 'implant'
    return 'action'
}

export const YIDAO: OpponentDef = {
    id: 'y1',
    name: '一刀',
    generate: (n) => {
        const bg = getBackground('swift')!
        const bgAttrs: Record<string, number> = {}
        for (const a of STAT_NAMES) bgAttrs[a] = bg.attrs[a] ?? 3

        const cultPoints = n * 2
        const target = { strength: 20, vitality: 11, agility: 14, dexterity: 13, insight: 13, wisdom: 7 }
        const prio = [...STAT_NAMES].sort((a, b) => (target[b] ?? 0) - (target[a] ?? 0))

        const result = { ...bgAttrs }
        let remaining = cultPoints
        while (remaining > 0) {
            let improved = false
            for (const attr of prio) {
                if (result[attr] >= (target[attr] ?? 99)) continue
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

        // 固定奖励
        const rewards: Reward[] = [
            { type: 'passive', id: 'iaijutsu_mastery', name: '居合极意', description: '', tags: [] },
        ]

        if (n >= 3) {
            const ratio = Math.min(1, (n - 2) / 31)
            const count = Math.round(POOL.length * ratio)
            const shuffled = [...POOL].sort(() => Math.random() - 0.5)
            const names: Record<string, string> = {
                iaijutsu_strike: '居合斩',
                slash: '斩击',
                foresight: '看破',
                resheath: '纳刀',
                empty_hand: '无刀取',
                tiger_eye: '虎彻之眼',
            }
            for (const id of shuffled.slice(0, count)) {
                rewards.push({ type: rewardType(id), id, name: names[id] ?? id, description: '', tags: [] })
            }
        }

        // 触发
        const hasSlash = rewards.some((r) => r.id === 'slash')

        const triggers: TriggerSlot[] = []
        if (hasSlash) triggers.push({ condition: { type: 'on_parry' }, actionId: 'slash' })

        return {
            id: 'y1',
            name: '一刀',
            background: 'swift',
            weapon: 'zantetsu',
            baseAttrs: result,
            rewards,
            triggers,
        }
    },
}

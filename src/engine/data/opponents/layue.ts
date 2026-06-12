import { type OpponentDef } from './base'
import type { Reward } from '../rewards'
import type { TriggerSlot } from '../../entities/trigger'
import { getBackground } from '../backgrounds'
import { STAT_NAMES } from '../rewards'
import { cultCost } from '../../systems/cultivation'

const POOL = ['nine_deaths_strike', 'cun_mang', 'sword_dominion', 'nine_deaths', 'wisdom_talisman']

/** 按 id 查询物品类型 */
function rewardType(id: string): 'passive' | 'artifact' | 'action' {
    if (id === 'sword_dominion' || id === 'nine_deaths') return 'passive'
    if (id === 'wisdom_talisman' || id === 'innate_seed') return 'artifact'
    return 'action'
}

export const LAYUE: OpponentDef = {
    id: 'l1',
    name: '腊月',
    generate: (n) => {
        const bg = getBackground('swift')!
        const bgAttrs: Record<string, number> = {}
        for (const a of STAT_NAMES) bgAttrs[a] = bg.attrs[a] ?? 3

        // 修炼点 = n×2 + 天生道种加成 floor((n-1)/3)
        const cultPoints = n * 2 + Math.max(0, Math.floor((n - 1) / 3))
        const target = { strength: 12, vitality: 6, agility: 16, dexterity: 16, insight: 16, wisdom: 6 }
        const prio = [...STAT_NAMES].sort((a, b) => (target[b] ?? 0) - (target[a] ?? 0))

        // Phase 1: 到 target
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

        // Phase 2: 溢出 → AGI → INS
        const overflowPrio = ['agility', 'insight']
        while (remaining > 0) {
            let improved = false
            for (const attr of overflowPrio) {
                if (result[attr] >= 24) continue
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

        // 奖励
        const rewards: Reward[] = []
        if (n >= 1) rewards.push({ type: 'artifact', id: 'innate_seed', name: '天生道种', description: '', tags: [] })
        if (n >= 3) {
            rewards.push({ type: 'passive', id: 'ling_bo_wei_bu', name: '凌波微步', description: '', tags: [] })
            const ratio = Math.min(1, (n - 2) / 31)
            const count = Math.round(POOL.length * ratio)
            const shuffled = [...POOL].sort(() => Math.random() - 0.5)
            const names: Record<string, string> = {
                nine_deaths_strike: '九死不悔',
                cun_mang: '寸芒',
                sword_dominion: '御剑诀',
                nine_deaths: '九死剑诀',
                wisdom_talisman: '通明符',
            }
            for (const id of shuffled.slice(0, count)) {
                rewards.push({ type: rewardType(id), id, name: names[id] ?? id, description: '', tags: [] })
            }
        }

        // 触发槽位
        const wis = result.wisdom
        const slots = Math.floor(wis / 4)
        const hasTalisman = rewards.some((r) => r.id === 'wisdom_talisman')
        const totalSlots = slots + (hasTalisman ? 1 : 0)
        const hasCunMang = rewards.some((r) => r.id === 'cun_mang')
        const hasNineDeaths = rewards.some((r) => r.id === 'nine_deaths_strike')

        const triggers: TriggerSlot[] = []
        let used = 0
        if (hasCunMang && used < totalSlots) {
            triggers.push({ condition: { type: 'on_dodged' }, actionId: 'cun_mang' })
            used++
        }
        if (hasNineDeaths && used < totalSlots) {
            triggers.push({ condition: { type: 'on_parry' }, actionId: 'nine_deaths_strike' })
            used++
        }
        // 通明符额外槽：对方闪避时
        if (hasTalisman && hasCunMang && used < totalSlots) {
            triggers.push({ condition: { type: 'on_parried' }, actionId: 'cun_mang' })
        }

        return {
            id: 'l1',
            name: '腊月',
            background: 'swift',
            weapon: n >= 2 ? 'twin_swords' : 'bare_hands',
            baseAttrs: result,
            rewards,
            triggers,
        }
    },
}

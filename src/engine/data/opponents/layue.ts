import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, artifact } from '.'
import type { Reward } from '../rewards'
import type { TriggerSlot } from '../../entities/trigger'

const POOL = ['nine_deaths_strike', 'cun_mang', 'sword_dominion', 'nine_deaths', 'wisdom_talisman']

/** 按 id 查询物品类型 */
function rewardType(id: string): 'passive' | 'artifact' | 'action' {
    if (id === 'sword_dominion' || id === 'nine_deaths') return 'passive'
    if (id === 'wisdom_talisman' || id === 'innate_seed') return 'artifact'
    return 'action'
}

export const LAYUE: OpponentDef = {
    id: 'layue',
    name: '腊月',
    generate: (n) => {
        const extra = Math.max(0, Math.floor((n - 1) / 3))
        const rewards: Reward[] = [
            artifact('innate_seed'),
            ...POOL.map((id) => ({ type: rewardType(id), id, name: id, description: '', tags: [] }) as Reward),
        ]

        // 触发槽位（n=33 时所有奖励齐全，触发确定）
        const triggers: TriggerSlot[] = [
            { condition: { type: 'on_dodged' }, actionId: 'cun_mang' },
            { condition: { type: 'on_parry' }, actionId: 'nine_deaths_strike' },
            { condition: { type: 'on_parried' }, actionId: 'cun_mang' },
        ]

        return simpleGenerate(
            'layue',
            '腊月',
            'swift',
            n >= 2 ? 'twin_swords' : 'bare_hands',
            { strength: 12, vitality: 8, agility: 20, dexterity: 16, insight: 16, wisdom: 8 },
            rewards,
            triggers,
            n,
            extra,
        )
    },
}

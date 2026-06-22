import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, artifact } from '.'
import type { Reward } from '../rewards'
import type { ActionConfig } from '../../entities/action-config'

const LAYUE_ATTRS = { strength: 12, vitality: 8, agility: 20, dexterity: 16, insight: 16, wisdom: 8 }

const POOL = ['nine_deaths_strike', 'cun_mang', 'sword_dominion', 'nine_deaths', 'wisdom_talisman']

/** 按 id 查询物品类型 */
function rewardType(id: string): 'passive' | 'artifact' | 'action' {
    if (id === 'sword_dominion' || id === 'nine_deaths') return 'passive'
    if (id === 'wisdom_talisman' || id === 'innate_seed') return 'artifact'
    return 'action'
}

export const LAYUE: OpponentDef = {
    id: 'layue',
    name: '什么·腊月',
    targetAttrs: LAYUE_ATTRS,
    generate: (n) => {
        const extra = Math.max(0, Math.floor((n - 1) / 3))
        const rewards: Reward[] = [
            artifact('innate_seed'),
            ...POOL.map((id) => ({ type: rewardType(id), id, name: id, description: '', tags: [] }) as Reward),
        ]

        const actionConfigs: ActionConfig[] = [
            { actionId: 'nine_deaths_strike' },
            { actionId: 'cun_mang' },
            { actionId: 'cun_mang', triggerId: 'on_dodged' },
            { actionId: 'nine_deaths_strike', triggerId: 'on_parry' },
            { actionId: 'cun_mang', triggerId: 'on_parried' },
        ]

        return simpleGenerate(
            'layue',
            '什么·腊月',
            'swift',
            n >= 2 ? 'twin_swords' : 'bare_hands',
            LAYUE_ATTRS,
            rewards,
            n,
            extra,
            actionConfigs,
        )
    },
}

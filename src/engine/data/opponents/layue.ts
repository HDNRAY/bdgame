import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef } from '.'
import type { Reward } from '../../entities/reward'
import type { ActionConfig } from '../../entities/action-config'

const LAYUE_ATTRS = { strength: 12, vitality: 8, agility: 20, dexterity: 16, insight: 16, wisdom: 8 }

export const LAYUE: OpponentDef = {
    id: 'layue',
    name: '什么·腊月',
    targetAttrs: LAYUE_ATTRS,
    generate: (n) => {
        const rewards: Reward[] = [
            { type: 'passive', id: 'sword_dominion', name: 'sword_dominion', description: '', tags: [] },
            { type: 'artifact', id: 'innate_seed', name: 'innate_seed', description: '', tags: [] },
            { type: 'action', id: 'cun_mang', name: 'cun_mang', description: '', tags: [] },
            { type: 'passive', id: 'nine_deaths', name: 'nine_deaths', description: '', tags: [] },
            { type: 'action', id: 'nine_deaths_strike', name: 'nine_deaths_strike', description: '', tags: [] },
            { type: 'artifact', id: 'wisdom_talisman', name: 'wisdom_talisman', description: '', tags: [] },
        ]

        const actionConfigs: ActionConfig[] = [
            { actionId: 'nine_deaths_strike' },
            { actionId: 'nine_deaths_strike', triggerId: 'on_parry' },
            { actionId: 'cun_mang', triggerId: 'on_parried' },
        ]

        return simpleGenerate('layue', '什么·腊月', 'swift', 'qing_shan_swords', LAYUE_ATTRS, rewards, n, actionConfigs)
    },
}

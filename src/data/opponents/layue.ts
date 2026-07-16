import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../util/reward-utils'

const LAYUE_ATTRS = { strength: 14, vitality: 10, agility: 20, dexterity: 16, insight: 16, wisdom: 4 }

export const LAYUE: OpponentDef = {
    id: 'layue',
    name: '什么·腊月',
    weapon: 'dual_swords',
    targetAttrs: LAYUE_ATTRS,
    rewards: [
        action('cun_mang'),
        weapon('fusi_sword'),
        passive('nine_deaths'),
        action('nine_deaths_strike'),
        passive('sword_intent_tempering'),
        passive('sword_dominion'),
        artifact('wisdom_talisman'),
        artifact('innate_seed'),
        artifact('buer_sword'),
        passive('tongtian'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'nine_deaths_strike' }, // AI 出招顺序
        { actionId: 'nine_deaths_strike', triggerId: 'on_opponent_move_away' },
        { actionId: 'cun_mang', triggerId: 'on_parried' },
    ],
}

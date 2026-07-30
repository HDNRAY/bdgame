import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const LAYUE_ATTRS = { strength: 14, vitality: 10, agility: 20, dexterity: 16, insight: 16, wisdom: 4 }

export const LAYUE: OpponentDef = {
    id: 'layue',
    name: '什么·腊月',
    weapon: 'qingfeng_jian',
    targetAttrs: LAYUE_ATTRS,
    rewards: [
        action('cun_mang'),
        passive('nine_deaths'),
        action('nine_deaths_strike'),
        passive('sword_intent_tempering'),
        weapon('fusi_sword'),
        passive('sword_dominion'),
        artifact('wisdom_talisman'),
        weapon('buer_sword'),
        passive('tongtian'),
        artifact('innate_seed'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'nine_deaths_strike' }, // AI 出招顺序
        { actionId: 'nine_deaths_strike', triggerId: 'on_opponent_move_away' },
        { actionId: 'cun_mang', triggerId: 'on_parried' },
    ],
}

import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const LAYUE_ATTRS = { strength: 14, vitality: 10, agility: 20, dexterity: 16, insight: 16, wisdom: 4 }

export const LAYUE: OpponentDef = {
    id: 'layue',
    name: '什么·腊月',
    weapon: 'peach_sword',
    targetAttrs: LAYUE_ATTRS,
    rewards: [
        action('cun_mang'),
        passive('last_sword'),
        action('nine_deaths_strike'),
        passive('sword_intent_tempering'),
        weapon('fusi_sword'),
        passive('sword_dominion'),
        artifact('wisdom_talisman'),
        weapon('buer_sword'),
        passive('tongtian'),
        artifact('innate_seed'),
        action('cang_niao_jian_fa'),
        // 剑丸
        // 11
    ],
    actionConfigs: [{ actionId: 'cun_mang', triggerId: 'on_parried' }],
}

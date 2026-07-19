import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const BAIHU_ATTRS = { strength: 14, vitality: 14, agility: 16, dexterity: 16, insight: 14, wisdom: 4 }

export const BAIHU: OpponentDef = {
    id: 'baihu',
    name: '白狐·南宫',
    weapon: 'dual_swords',
    targetAttrs: BAIHU_ATTRS,
    rewards: [
        action('light_slash'),
        passive('ice_heart'),
        passive('frost_mastery'),
        passive('frost_step'),
        artifact('frost_silk_robe'),
        weapon('frost_twin_blades'),
        action('heavy_slash'),
        action('guard'),
        artifact('wisdom_talisman'),
        action('nineteen_stops'),
        // 听潮九剑
        // 9
    ],
    actionConfigs: [{ actionId: 'light_slash', triggerId: 'on_dodged' }],
}

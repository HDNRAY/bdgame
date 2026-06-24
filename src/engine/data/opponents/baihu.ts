import { type OpponentDef } from '.'
import { passive, artifact, action } from '../../systems/reward-pool'

const BAIHU_ATTRS = { strength: 14, vitality: 14, agility: 16, dexterity: 16, insight: 14, wisdom: 4 }

export const BAIHU: OpponentDef = {
    id: 'baihu',
    name: '白狐·南宫',
    battleStyle: 'swift',
    weapon: 'frost_twin_blades',
    targetAttrs: BAIHU_ATTRS,
    rewards: [
        action('light_slash'),
        passive('ice_heart'),
        passive('frost_mastery'),
        passive('frost_step_mastery'),
        artifact('frost_silk_robe'),
        action('heavy_slash'),
        action('guard'),
        action('nineteen_stops'),
    ],
    actionConfigs: [
        { actionId: 'nineteen_stops' },
        { actionId: 'light_slash' },
        { actionId: 'heavy_slash' },
        { actionId: 'guard', triggerId: 'on_dodged' },
    ],
}

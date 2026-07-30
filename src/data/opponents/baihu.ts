import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const BAIHU_ATTRS = { strength: 14, vitality: 14, agility: 16, dexterity: 16, insight: 14, wisdom: 4 }

export const BAIHU: OpponentDef = {
    id: 'baihu',
    name: '南宫狐儿',
    weapon: 'peach_sword',
    targetAttrs: BAIHU_ATTRS,
    rewards: [
        action('light_slash'),
        passive('ice_heart'),
        passive('frost_mastery'),
        passive('frost_step'),
        artifact('wisdom_talisman'),
        action('rising_slash'),
        weapon('xiu_dong'),
        action('heavy_slash'),
        action('guard'),
        artifact('frost_silk_robe'),
        weapon('chun_lei'),
        action('nineteen_stops'),
        // 听潮九剑
        // 11
    ],
    actionConfigs: [
        { actionId: 'light_slash', triggerId: 'on_dodged' },
        {
            actionId: 'rising_slash',
            triggerId: 'on_parry',
        },
    ],
}

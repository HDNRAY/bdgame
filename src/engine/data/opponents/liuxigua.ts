import { type OpponentDef } from '.'
import { passive, action, weapon } from '../../systems/reward-pool'

const LIUXIGUA_ATTRS = { strength: 14, vitality: 10, agility: 20, dexterity: 15, insight: 12, wisdom: 4 }

export const LIUXIGUA: OpponentDef = {
    id: 'liuxigua',
    name: '霸刀·西瓜',
    weapon: 'qingfeng_jian',
    targetAttrs: LIUXIGUA_ATTRS,
    rewards: [
        action('spinning_slash'),
        passive('momentum_mastery'),
        passive('overlord_art'),
        weapon('overlord_blade'),
        action('little_fist'),
        action('shadow_kick'),
        action('cyclone_slash'),
        action('sky_burner'),
        action('retrieve_blade'),
    ],
}

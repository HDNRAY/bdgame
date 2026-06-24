import { type OpponentDef } from '.'
import { passive, artifact, action } from '../../systems/reward-pool'

const SANGYUAN_ATTRS = { strength: 12, vitality: 20, agility: 8, dexterity: 18, insight: 10, wisdom: 4 }

export const SANGYUAN: OpponentDef = {
    id: 'sangyuan',
    name: '灵剑·桑原',
    weapon: 'bare_hands',
    targetAttrs: SANGYUAN_ATTRS,
    rewards: [
        action('light_slash'),
        passive('dimensional_blade_mastery'),
        artifact('qi_amplifier'),
        action('spirit_sword'),
        action('heavy_slash'),
        action('big_leap'),
    ],
    actionConfigs: [{ actionId: 'light_slash', triggerId: 'on_dodged' }],
}

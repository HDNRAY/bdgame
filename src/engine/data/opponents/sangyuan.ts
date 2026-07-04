import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../util/reward-utils'

const SANGYUAN_ATTRS = { strength: 12, vitality: 20, agility: 8, dexterity: 18, insight: 10, wisdom: 4 }

export const SANGYUAN: OpponentDef = {
    id: 'sangyuan',
    name: '灵剑·桑原',
    weapon: 'qingfeng_jian',
    targetAttrs: SANGYUAN_ATTRS,
    rewards: [
        action('light_slash'),
        action('spirit_sword'),
        action('horizontal_slash'),
        artifact('qi_amplifier'),
        action('big_leap'),
        action('heavy_slash'),
        action('sword_intent_burst'),
        passive('sword_focus'),
        artifact('combat_armor'),
        action('qi_slash'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'spirit_sword' },
        { actionId: 'sword_intent_burst' },
        { actionId: 'heavy_slash' },
        { actionId: 'big_leap' },
        { actionId: 'light_slash', triggerId: 'on_dodged' },
    ],
}

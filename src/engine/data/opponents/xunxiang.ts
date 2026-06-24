import { type OpponentDef } from '.'
import { passive, action } from '../../systems/reward-pool'

const XUNXIANG_ATTRS = { strength: 4, vitality: 6, agility: 16, dexterity: 14, insight: 14, wisdom: 20 }

export const XUNXIANG: OpponentDef = {
    id: 'xunxiang',
    name: '小凤·寻香',
    battleStyle: 'ranged',
    weapon: 'bare_hands',
    targetAttrs: XUNXIANG_ATTRS,
    rewards: [
        action('straight_punch'),
        passive('lingxi_finger'),
        passive('yedi_lightness'),
        action('wrist_strike'),
        action('throwing_knife'),
        action('push_palm'),
        action('push_hand'),
        action('deadly_knife'),
        action('steal_artifact'),
    ],
    actionConfigs: [
        { actionId: 'push_hand', triggerId: 'on_parry' },
        { actionId: 'throwing_knife', triggerId: 'on_dodged' },
        { actionId: 'steal_artifact', triggerId: 'on_dodge' },
    ],
}

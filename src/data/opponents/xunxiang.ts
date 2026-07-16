import { type OpponentDef } from '.'
import { action, passive } from '../../engine/util/reward-utils'

const XUNXIANG_ATTRS = { strength: 4, vitality: 6, agility: 16, dexterity: 14, insight: 14, wisdom: 20 }

export const XUNXIANG: OpponentDef = {
    id: 'xunxiang',
    name: '小凤·寻香',
    battleStyle: 'ranged',
    weapon: 'bare_hands',
    targetAttrs: XUNXIANG_ATTRS,
    rewards: [
        action('push_palm'),
        action('throwing_knife'),
        passive('lingxi_finger'),
        passive('yedi_lightness'),
        action('steal_artifact'),
        action('deadly_knife'),
        action('wrist_strike'),
        passive('li_wu_xu_fa'),
        passive('dian_xue_passive'),
        action('push_hand'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'wrist_strike' }, // AI 出招顺序
        { actionId: 'throwing_knife', triggerId: 'on_dodged' }, // AI 出招顺序
        { actionId: 'push_hand', triggerId: 'on_parry' },
        { actionId: 'push_palm', triggerId: 'on_opponent_move_closer' },
        { actionId: 'deadly_knife' }, // AI 出招顺序
        { actionId: 'steal_artifact', triggerId: 'on_turn_start' },
    ],
}

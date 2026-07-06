import { type OpponentDef } from '.'
import { action, passive } from '../../util/reward-utils'

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
        action('dian_xue'),
        action('push_hand'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'dian_xue', triggerId: 'on_dodge' }, // AI 出招顺序
        { actionId: 'wrist_strike' }, // AI 出招顺序
        { actionId: 'push_palm', triggerId: 'on_parry' }, // AI 出招顺序
        { actionId: 'push_hand', triggerId: 'on_parried' },
        { actionId: 'throwing_knife', triggerId: 'on_opponent_move_away' },
        { actionId: 'deadly_knife' }, // AI 出招顺序
        { actionId: 'steal_artifact', triggerId: 'on_turn_start' },
    ],
}

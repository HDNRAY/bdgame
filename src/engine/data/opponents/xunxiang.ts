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
        // 9
    ],
    actionConfigs: [
        { actionId: 'straight_punch' }, // AI 出招顺序
        { actionId: 'wrist_strike' }, // AI 出招顺序
        { actionId: 'push_palm', triggerId: 'on_parry' }, // AI 出招顺序
        { actionId: 'push_hand', triggerId: 'on_parried' },
        { actionId: 'throwing_knife', triggerId: 'on_opponent_move' },
        { actionId: 'deadly_knife' }, // AI 出招顺序
        { actionId: 'steal_artifact', triggerId: 'on_dodge' },
    ],
}

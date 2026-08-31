import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const HONGTI_ATTRS = { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 15, wisdom: 20 }

export const HONGTI: OpponentDef = {
    id: 'hongti',
    name: '白山月',
    weapon: 'dagger',
    targetAttrs: HONGTI_ATTRS,
    battleStyle: 'melee',
    rewards: [
        action('sword_thrust'),
        passive('inner_power'),
        weapon('heshan_sword'),
        artifact('other_mountain'),
        passive('tai_chi_mastery'),
        passive('yue_nv_sword'),
        passive('bu_zhi_yu_wu'),
        action('qi_slash'),
        action('push_palm'),
        action('wrist_strike'), // 点腕
        action('crushing_blow'), // 崩拳
        action('qi_bolt'),
        action('break_formation'),
        // 12
    ],
    actionConfigs: [
        { actionId: 'push_palm', triggerId: 'on_parry' },
        { actionId: 'wrist_strike', triggerId: 'on_dodged' },
        { actionId: 'qi_slash', triggerId: 'on_dodge' },
        { actionId: 'qi_bolt', triggerId: 'on_opponent_move_away', conditionId: 'distance_gt_4' },
        { actionId: 'break_formation', triggerId: 'on_debuff' },
    ],
}

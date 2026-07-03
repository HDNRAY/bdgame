import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../util/reward-utils'

const LUHONGTI_ATTRS = { strength: 10, vitality: 9, agility: 10, dexterity: 9, insight: 16, wisdom: 20 }

export const LUHONGTI: OpponentDef = {
    id: 'luhongti',
    name: '铁剑·红提',
    weapon: 'qingfeng_jian',
    targetAttrs: LUHONGTI_ATTRS,
    rewards: [
        action('sword_thrust'),
        passive('inner_power'),
        weapon('heshan_sword'),
        artifact('other_mountain'),
        passive('tai_chi_mastery'),
        passive('yue_nv_sword'),
        action('light_slash'),
        action('push_palm'),
        action('wrist_strike'), // 点腕
        action('crushing_blow'), // 崩拳
        action('qi_bolt'),
        action('break_formation'),
        // 12
    ],
    actionConfigs: [
        { actionId: 'sword_thrust' }, // AI 出招顺序
        { actionId: 'crushing_blow' }, // AI 出招顺序
        { actionId: 'push_palm', triggerId: 'was_hit' },
        { actionId: 'wrist_strike', triggerId: 'on_dodge' },
        { actionId: 'light_slash', triggerId: 'on_dodged' },
        { actionId: 'qi_bolt', triggerId: 'on_opponent_move_away', conditionId: 'distance_gt_4' },
        { actionId: 'break_formation', triggerId: 'on_debuff' },
    ],
}

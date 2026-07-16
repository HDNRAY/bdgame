import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const LAIFENG_ATTRS = { strength: 14, vitality: 8, agility: 20, dexterity: 12, insight: 10, wisdom: 12 }

export const LAIFENG: OpponentDef = {
    id: 'laifeng',
    name: '空拳·来风',
    weapon: 'bare_hands',
    targetAttrs: LAIFENG_ATTRS,
    rewards: [
        action('straight_punch'),
        passive('forge'),
        artifact('qi_amplifier'),
        passive('ningqi_jue'),
        action('iron_charge'),
        action('qi_bolt'),
        action('eighteen_palms'),
        action('lion_roar'),
        action('cun_jin'),
        action('qinlong_gong'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'qi_gather' }, // AI 出招顺序
        { actionId: 'straight_punch' }, // AI 出招顺序
        { actionId: 'cun_jin' }, // AI 出招顺序
        { actionId: 'eighteen_palms' }, // AI 出招顺序
        { actionId: 'lion_roar', conditionId: 'distance_gt_2' },
        { actionId: 'qi_bolt', triggerId: 'on_opponent_move_away' },
        { actionId: 'qinlong_gong', triggerId: 'on_dodge' },
    ],
}

import { type OpponentDef } from '.'
import { passive, artifact, action } from '../../systems/reward-pool'

const LAIFENG_ATTRS = { strength: 14, vitality: 8, agility: 20, dexterity: 12, insight: 10, wisdom: 12 }

export const LAIFENG: OpponentDef = {
    id: 'laifeng',
    name: '空拳·来风',
    battleStyle: 'balanced',
    weapon: 'bare_hands',
    targetAttrs: LAIFENG_ATTRS,
    rewards: [
        action('straight_punch'),
        passive('forge'),
        artifact('qi_amplifier'),
        action('straight_punch'),
        action('qi_focus'),
        action('qi_gather'),
        action('iron_charge'),
        action('qi_bolt'),
        action('eighteen_palms'),
    ],
    actionConfigs: [
        { actionId: 'qi_focus' },
        { actionId: 'qi_gather' },
        { actionId: 'straight_punch' },
        { actionId: 'iron_charge' },
        { actionId: 'eighteen_palms' },
        { actionId: 'qi_bolt', triggerId: 'on_opponent_move' },
        { actionId: 'qinlong_gong', triggerId: 'on_dodge' },
    ],
}

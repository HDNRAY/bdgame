import { type OpponentDef } from '.'
import { passive, artifact, action } from '../../systems/reward-pool'

const LONGNV_ATTRS = { strength: 15, vitality: 10, agility: 14, dexterity: 18, insight: 12, wisdom: 8 }

export const LONGNV: OpponentDef = {
    id: 'longnv',
    name: '龙女·语嫣',
    weapon: 'dual_swords',
    battleStyle: 'melee',
    targetAttrs: LONGNV_ATTRS,
    rewards: [
        action('yunv_sword'),
        passive('dark_room_catch'),
        action('quanzhen_sword'),
        artifact('golden_silk_gloves'),
        artifact('herb_pouch'),
        artifact('golden_bell_rope'),
        passive('yuxin_sword_mastery'),
        passive('martial_arts_archive'),
        action('yufeng_needle'),
        action('sword_thrust'),
        // 10
    ],
    actionConfigs: [
        { actionId: '_golden_bell_swing', conditionId: 'distance_gt_4', triggerId: 'on_parry' },
        { actionId: 'yufeng_needle', conditionId: 'distance_gt_4', triggerId: 'on_opponent_move' },
    ],
}

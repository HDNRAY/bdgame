import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const LONGNV_ATTRS = { strength: 16, vitality: 10, agility: 15, dexterity: 18, insight: 12, wisdom: 4 }

export const LONGNV: OpponentDef = {
    id: 'longnv',
    name: '龙语仙',
    weapon: 'dual_swords',
    battleStyle: 'melee',
    targetAttrs: LONGNV_ATTRS,
    rewards: [
        action('sword_thrust'),
        passive('martial_arts_archive'),
        action('yunv_sword'),
        passive('dark_room_catch'),
        action('quanzhen_sword'),
        artifact('golden_silk_gloves'),
        artifact('herb_pouch'),
        artifact('golden_bell_rope'),
        passive('yuxin_sword_mastery'),
        action('yufeng_needle'),
        // 10
    ],
    actionConfigs: [{ actionId: 'yufeng_needle', conditionId: 'distance_gt_4', triggerId: 'on_opponent_move_away' }],
}

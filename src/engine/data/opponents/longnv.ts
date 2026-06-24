import { type OpponentDef } from '.'
import { passive, artifact, action } from '../../systems/reward-pool'

const LONGNV_ATTRS = { strength: 16, vitality: 10, agility: 14, dexterity: 18, insight: 14, wisdom: 4 }

export const LONGNV: OpponentDef = {
    id: 'longnv',
    name: '龙女·语嫣',
    weapon: 'dual_swords',
    targetAttrs: LONGNV_ATTRS,
    rewards: [
        action('yunv_sword'),
        passive('dark_room_catch'),
        action('quanzhen_sword'),
        artifact('golden_silk_gloves'),
        artifact('herb_pouch'),
        passive('yuxin_sword_mastery'),
        action('yufeng_needle'),
        // 7
    ],
    actionConfigs: [
        { actionId: 'yufeng_needle', triggerId: 'on_opponent_move' }, // AI 出招顺序
    ],
}

import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const LONGNV_ATTRS = { strength: 16, vitality: 10, agility: 15, dexterity: 18, insight: 12, wisdom: 4 }

export const LONGNV: OpponentDef = {
    id: 'longnv',
    name: '龙语仙',
    weapon: 'peach_sword',
    battleStyle: 'melee',
    targetAttrs: LONGNV_ATTRS,
    rewards: [
        action('yunv_sword'),
        action('quanzhen_sword'),
        passive('dark_room_catch'),
        artifact('golden_silk_gloves'),
        artifact('herb_pouch'),
        artifact('golden_bell_rope'),
        passive('yuxin_sword_mastery'),
        artifact('wuxue_baodian_shang'),
        action('yufeng_needle'),
        weapon('moxie_sword'),
        weapon('ganjiang_sword'),
        artifact('wuxue_baodian_xia'),
        artifact('jiu_yin_zhen_jing'),
        // 13
    ],
    actionConfigs: [{ actionId: 'yufeng_needle', triggerId: 'on_opponent_move_away' }],
}

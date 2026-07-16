import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const TANGROU_ATTRS = { strength: 6, vitality: 10, agility: 14, dexterity: 20, insight: 16, wisdom: 8 }

export const TANGROU: OpponentDef = {
    id: 'tangrou',
    name: '灵素·唐柔',
    story: '唐门旁支传人，以银针使毒闻名。外表温婉可亲，出手却凌厉致命。',
    battleStyle: 'ranged',
    weapon: 'bare_hands',
    targetAttrs: TANGROU_ATTRS,
    rewards: [
        action('yin_zhen'),
        passive('jing_luo_chu_jian'),
        artifact('qi_xin_hai_tang'),
        artifact('poison_coating'),
        passive('dian_xue_passive'),
        passive('fei_hua_shou'),
        action('iron_pellet'),
        action('push_hand'),
        artifact('tempest'),
        artifact('qing_nang_san_bao'),
        // 10
    ],
    actionConfigs: [{ actionId: 'push_hand', triggerId: 'on_parry' }],
}

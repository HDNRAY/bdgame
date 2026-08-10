import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const LAIFENG_ATTRS = { strength: 14, vitality: 8, agility: 20, dexterity: 12, insight: 10, wisdom: 12 }

export const LAIFENG: OpponentDef = {
    id: 'laifeng',
    name: '空拳·来风',
    story: '药屋后人，幼年便失去了味觉。但失去味觉从未困扰过他——他将全部的专注力投入武道，以纯粹的体术和炁劲外放见长，拳法凌厉如风，被誉为「空拳」。',
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
        action('cun_jin'),
        action('qinlong_gong'),
        artifact('bu_lao_quan'),
        artifact('jiu_yin_zhen_jing'),
        // 11
    ],
    actionConfigs: [
        { actionId: 'straight_punch', triggerId: 'on_dodged' }, // AI 出招顺序
        { actionId: 'cun_jin' }, // AI 出招顺序
        { actionId: 'eighteen_palms' }, // AI 出招顺序
        { actionId: 'qi_bolt', triggerId: 'on_opponent_move_away' },
        { actionId: 'qinlong_gong', triggerId: 'on_dodge' },
    ],
}

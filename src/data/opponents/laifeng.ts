import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const LAIFENG_ATTRS = { strength: 14, vitality: 8, agility: 20, dexterity: 12, insight: 10, wisdom: 12 }

export const LAIFENG: OpponentDef = {
    id: 'laifeng',
    name: '空拳·来风',
    story: '药屋后人，幼年便失去了味觉。但失去味觉从未困扰过他——他将全部的专注力投入武道，以纯粹的体术和炁劲外放见长，拳法凌厉如风，被誉为「空拳」。',
    weapon: 'bare_hands',
    battleStyle: 'mid',
    targetAttrs: LAIFENG_ATTRS,
    rewards: [
        action('straight_punch'),
        passive('forge'),
        artifact('qi_amplifier'),
        passive('ningqi_jue'),
        action('qi_bolt_2'),
        passive('beiming'),
        action('eighteen_palms'),
        artifact('frog_gall'),
        action('qi_bolt_4'),
        action('qinlong_gong'),
        artifact('zhu_ye_qing'),
        artifact('jiu_yin_zhen_jing'),
        passive('rui_qi_jue'), // 锐炁诀：与凝炁诀联动，全招 40% 穿透
        // 13
    ],
    actionConfigs: [
        { actionId: 'qi_bolt_4', triggerId: 'on_move_closer' }, // AI 出招顺序
        { actionId: 'eighteen_palms' }, // AI 出招顺序
        { actionId: 'qi_bolt_2', triggerId: 'on_move_away' },
        { actionId: 'qinlong_gong', triggerId: 'on_dodge' },
    ],
}

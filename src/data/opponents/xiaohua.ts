import { type OpponentDef } from '.'
import { action, passive, weapon } from '../../engine/util/reward-utils'

const ATTRS = { strength: 14, vitality: 12, agility: 14, dexterity: 14, insight: 10, wisdom: 16 }

export const XIAOHUA: OpponentDef = {
    id: 'xiaohua',
    name: '药屋花',
    story: '药屋后人。不到三十岁那年，她失去了视觉。\n\n看不见以后，她以推演补回「眼睛」，自创「无明之明」，人称「花大师」。',
    weapon: 'bare_hands',
    battleStyle: 'clinch',
    targetAttrs: ATTRS,
    rewards: [
        action('ba_gua_you_shen_zhang'),
        passive('ningqi_jue'),
        action('zhemei_shou'),
        action('wind_hear'),
        passive('no_light_wisdom'),
        passive('hearing_power'),
        passive('lingxi_finger'),
        action('three_inch_light'),
        weapon('iron_back_hand'),
        passive('mingjing_zhishui'),
        action('wrist_strike'),
        action('liu_yang_zhang'),
        passive('ru_shen_zuo_zhao'),
        // 13
    ],
    actionConfigs: [
        {
            actionId: 'ba_gua_you_shen_zhang',
            triggerId: 'on_dodged',
        },
        {
            actionId: 'zhemei_shou',
            triggerId: 'on_parried',
        },
        {
            actionId: 'wrist_strike',
            triggerId: 'on_dodge',
        },
        {
            actionId: 'liu_yang_zhang',
            triggerId: 'on_parry',
        },
    ],
}

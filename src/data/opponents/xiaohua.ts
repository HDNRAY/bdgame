import { type OpponentDef } from '.'
import { action, passive, weapon } from '../../engine/util/reward-utils'

const ATTRS = { strength: 14, vitality: 12, agility: 14, dexterity: 12, insight: 10, wisdom: 18 }

export const XIAOHUA: OpponentDef = {
    id: 'xiaohua',
    name: '范小花',
    weapon: 'bare_hands',
    targetAttrs: ATTRS,
    rewards: [
        action('ba_gua_you_shen_zhang'),
        passive('no_light_wisdom'),
        action('zhemei_shou'),
        passive('hearing_power'),
        passive('lingxi_finger'),
        action('wind_hear'),
        action('three_inch_light'),
        weapon('iron_back_hand'),
        passive('mingjing_zhishui'),
    ],
    actionConfigs: [
        {
            actionId: 'ba_gua_you_shen_zhang',
        },
    ],
}

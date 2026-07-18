import { type OpponentDef } from '.'
import { action, passive, weapon } from '../../engine/util/reward-utils'

const ATTRS = { strength: 14, vitality: 12, agility: 14, dexterity: 14, insight: 10, wisdom: 16 }

export const XIAOHUA: OpponentDef = {
    id: 'xiaohua',
    name: '药屋小花',
    story: '药屋后人。不到三十岁那年失去了视觉，世界骤然归于黑暗。\n\n但她没有止步。以推演代洞察，以心眼观万物，自创「无明之明」，终成一代拳掌宗师。教出的弟子无一不是江湖赫赫有名的人物。\n\n然而近两年来，她已不再收徒。无人能学会她的「无明之明」——那是盲人用一生黑暗换来的感知，有眼之人如何学得会？',
    weapon: 'bare_hands',
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
        // 10
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
    ],
}

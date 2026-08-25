import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const ATTRS = { strength: 12, vitality: 12, agility: 14, dexterity: 14, insight: 14, wisdom: 15 }

export const HAORAN: OpponentDef = {
    id: 'haoran',
    name: '宁浩然',
    story: '持剑书生。以炁催动剑意，剑意化为万象。',
    battleStyle: 'mid',
    weapon: 'peach_sword',
    targetAttrs: ATTRS,
    rewards: [
        action('swift_thunder_sword'),
        passive('inner_power'),
        action('spirit_sword'),
        action('blowing_snow_sword'),
        action('spring_bamboo_sword'),
        action('cloud_hidden_sword'),
        action('fall_to_azure_sword'),
        artifact('qi_amplifier'),
        passive('jiu_yang_shen_gong'),
        artifact('shao_dao_zi'),
        passive('wan_xiang_jian_yi'),
        passive('ling_long_xin_qiao'),
        passive('yi_dian_po_xiao'),
        // 13
    ],
    actionConfigs: [
        {
            actionId: 'fall_to_azure_sword',
            conditionId: 'always',
        },
        {
            actionId: 'spring_bamboo_sword',
            conditionId: 'hp_below_70',
        },
        {
            actionId: 'swift_thunder_sword',
            conditionId: 'thunder_swift_lt_2',
            triggerId: 'on_parried',
        },
        {
            actionId: 'cloud_hidden_sword',
            conditionId: 'yun_yin_lt_2',
            triggerId: 'on_dodge',
        },
        {
            actionId: 'blowing_snow_sword',
            conditionId: 'chill_blade_lt_2',
            triggerId: 'on_dodged',
        },
    ],
    taunt: () => '道法自然，剑亦自然。',
}

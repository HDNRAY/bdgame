import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const ATTRS = { strength: 10, vitality: 12, agility: 14, dexterity: 14, insight: 14, wisdom: 16 }

export const HAORAN: OpponentDef = {
    id: 'haoran',
    name: '宁浩然',
    story: '持剑的书生，一身旧衫洗得发白。他的剑意能拟出万象——你常常只来得及看见他收剑。',
    battleStyle: 'melee',
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
        artifact('zhu_ye_qing'),
        passive('wan_xiang_jian_yi'),
        passive('ling_long_xin_qiao'),
        passive('yi_dian_po_xiao'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'fall_to_azure_sword' },
        {
            actionId: 'spring_bamboo_sword',
            condition: { type: 'hp_below', ratio: 0.7 },
            triggerId: 'on_parry',
        },
        {
            actionId: 'swift_thunder_sword',
            condition: { type: 'buff_stacks_below', buffId: 'thunder_swift', maxStacks: 2 },
            triggerId: 'on_parried',
        },
        {
            actionId: 'cloud_hidden_sword',
            condition: { type: 'buff_stacks_below', buffId: 'yun_yin', maxStacks: 2 },
            triggerId: 'on_dodge',
        },
        {
            actionId: 'blowing_snow_sword',
            condition: { type: 'buff_stacks_below', buffId: 'chill_blade', maxStacks: 2 },
            triggerId: 'on_dodged',
        },
    ],
    taunt: () => '道法自然，剑亦自然。',
}

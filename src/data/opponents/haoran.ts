import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const ATTRS = { strength: 14, vitality: 12, agility: 14, dexterity: 14, insight: 14, wisdom: 14 }

export const HAORAN: OpponentDef = {
    id: 'haoran',
    name: '宁浩然',
    story: '持剑道士，讲究又不讲究。会元素剑法，以炁化为意象。',
    battleStyle: 'mid',
    weapon: 'peach_sword',
    targetAttrs: ATTRS,
    rewards: [
        action('qi_slash'),
        passive('inner_power'),
        action('spirit_sword'),
        action('swift_thunder_sword'),
        action('blowing_snow_sword'),
        action('spring_bamboo_sword'),
        action('fall_to_azure_sword'),
        artifact('qi_amplifier'),
        passive('jiu_yang_shen_gong'),
        artifact('nv_er_hong'),
        // 10
    ],
    actionConfigs: [
        {
            actionId: 'qi_slash',
            triggerId: 'on_dodged',
        },
        {
            actionId: 'fall_to_azure_sword',
            conditionId: 'always',
        },
        {
            actionId: 'spring_bamboo_sword',
            conditionId: 'bamboo_regen_lt_2',
        },
        {
            actionId: 'swift_thunder_sword',
            conditionId: 'thunder_swift_lt_2',
        },
        {
            actionId: 'blowing_snow_sword',
            conditionId: 'chill_blade_lt_2',
        },
    ],
    taunt: () => '道法自然，剑亦自然。',
}

import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../util/reward-utils'

const ATTRS = { strength: 14, vitality: 12, agility: 14, dexterity: 14, insight: 14, wisdom: 14 }

export const HAORAN: OpponentDef = {
    id: 'haoran',
    name: '浩然·潮生',
    story: '持剑道士，讲究又不讲究。会元素剑法，以炁化为意象。',
    battleStyle: 'mid',
    weapon: 'qingfeng_jian',
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
        artifact('bu_lao_quan'),
        // 10
    ],
    actionConfigs: [],
    taunt: () => '道法自然，剑亦自然。',
}

import { OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const AJIU_ATTRS = { strength: 14, vitality: 10, agility: 18, dexterity: 14, insight: 16, wisdom: 4 }

export const AJIU: OpponentDef = {
    id: 'ajiu',
    name: '阿九',
    weapon: 'peach_sword',
    targetAttrs: AJIU_ATTRS,
    rewards: [
        action('horizontal_slash'),
        weapon('broken_blade'),
        action('spirit_sword'),
        passive('shenxing_baibian'),
        action('blaze_strike'),
        passive('zhu_huo_jue'),
        artifact('titanium_arm'),
        action('iron_pellet'),
        artifact('muscle_boost'),
        passive('xuannv_sword'),
        artifact('power_furnace'),
        passive('ku_chan_shen_gong'),
        // 12
    ],
    actionConfigs: [
        {
            actionId: 'iron_pellet',
            triggerId: 'on_dodged',
        },
        { actionId: '_arm_explosion', conditionId: 'hp_below_50' },
    ],
    taunt: () => '……让开。',
}

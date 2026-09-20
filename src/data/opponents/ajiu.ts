import { OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const AJIU_ATTRS = { strength: 10, vitality: 14, agility: 18, dexterity: 14, insight: 16, wisdom: 4 }

export const AJIU: OpponentDef = {
    id: 'ajiu',
    name: '阿九',
    weapon: 'peach_sword',
    targetAttrs: AJIU_ATTRS,
    battleStyle: 'melee',
    rewards: [
        action('blaze_strike'),
        weapon('broken_blade'),
        action('spirit_sword'),
        passive('shenxing_baibian'),
        passive('zhu_huo_jue'),
        artifact('titanium_arm'),
        action('dart_throw'),
        artifact('mechanical_eye'),
        artifact('muscle_boost'),
        passive('xuannv_sword'),
        artifact('power_furnace'),
        passive('ku_chan_shen_gong'),
        passive('feng_mo_gong'),
        // 13
    ],
    actionConfigs: [
        {
            actionId: 'blaze_strike',
            triggerId: 'on_dodged',
        },
        { actionId: '_arm_explosion', condition: { type: 'hp_below', ratio: 0.4 } },
    ],
    taunt: () => '……让开。',
}

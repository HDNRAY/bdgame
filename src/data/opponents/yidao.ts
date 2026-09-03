import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const YIDAO_ATTRS = { strength: 18, vitality: 10, agility: 15, dexterity: 14, insight: 14, wisdom: 6 }

export const YIDAO: OpponentDef = {
    id: 'yidao',
    name: '一刀',
    weapon: 'peach_sword',
    battleStyle: 'melee',
    targetAttrs: YIDAO_ATTRS,
    rewards: [
        action('qi_slash'),
        passive('iaijutsu_mastery'),
        passive('dragon_palace_style'),
        artifact('wakizashi'),
        passive('human_radar'),
        artifact('tiger_eye'),
        weapon('zantetsu'),
        passive('extreme'),
        passive('enhanced_vision'),
        passive('stance_time'),
        artifact('chan_orb'),
        action('dian_bu'),
        passive('yi_dao_liu'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'resheath', conditionId: 'no_stance' },
        {
            actionId: 'qi_slash',
            triggerId: 'on_dodged',
        },
    ],
}

import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../util/reward-utils'

const YIDAO_ATTRS = { strength: 18, vitality: 10, agility: 15, dexterity: 14, insight: 14, wisdom: 6 }

export const YIDAO: OpponentDef = {
    id: 'yidao',
    name: '居合·一刀',
    weapon: 'qingfeng_jian',
    battleStyle: 'mid',
    targetAttrs: YIDAO_ATTRS,
    rewards: [
        action('qi_slash'),
        passive('iaijutsu_mastery'),
        passive('dragon_palace_style'),
        artifact('wakizashi'),
        passive('human_radar'),
        artifact('tiger_eye'),
        artifact('chan_orb'),
        weapon('zantetsu'),
        passive('extreme'),
        passive('stance_time'),
        // 10
    ],
    actionConfigs: [{ actionId: 'resheath', conditionId: 'no_stance' }],
}

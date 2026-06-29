import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../systems/reward-pool'

const YIDAO_ATTRS = { strength: 18, vitality: 11, agility: 15, dexterity: 14, insight: 13, wisdom: 6 }

export const YIDAO: OpponentDef = {
    id: 'yidao',
    name: '居合·一刀',
    weapon: 'qingfeng_jian',
    battleStyle: 'mid',
    targetAttrs: YIDAO_ATTRS,
    rewards: [
        action('qi_slash'),
        action('iaijutsu_strike'),
        action('resheath'),
        passive('iaijutsu_mastery'),
        passive('empty_hand'),
        passive('human_radar'),
        artifact('tiger_eye'),
        weapon('zantetsu'),
        passive('extreme'),
        // passive('qi_edge'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'iaijutsu_strike' },
        { actionId: 'light_slash' },
        { actionId: 'resheath', conditionId: 'no_stance' },
    ],
}

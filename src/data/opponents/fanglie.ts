import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const FANGLIE_ATTRS = { strength: 16, vitality: 13, agility: 17, dexterity: 14, insight: 13, wisdom: 4 }

export const FANGLIE: OpponentDef = {
    id: 'fanglie',
    name: '方烈',
    story: '军旅出身。退伍后只身回到镇上，独来独往，枪不离手。没人知道他退伍前那几年经历了什么。',
    weapon: 'long_spear',
    battleStyle: 'mid',
    targetAttrs: FANGLIE_ATTRS,
    rewards: [
        action('pursuit_thrust'),
        passive('iron_bone'),
        passive('ji_lie_zhi_lie'),
        artifact('hydraulic_leg'),
        artifact('nano_metal_heart'),
        artifact('neural_net'),
        action('rod_sweep'),
        artifact('blood_thorn_ring'),
        artifact('blood_thorn_earring'),
        action('thrust'),
        weapon('iron_spear'),
        action('return_spear'),
        passive('qing_long_ding'),
        // 13
    ],
    actionConfigs: [
        {
            actionId: 'rod_sweep',
            conditionId: 'distance_lt_2',
        },
        { actionId: 'pursuit_thrust', triggerId: 'on_bleed' },
    ],
    taunt: () => '别怨我。各为其主。',
}

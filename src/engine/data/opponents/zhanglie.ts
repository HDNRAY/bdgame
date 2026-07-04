import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../util/reward-utils'

const ZHANGLIE_ATTRS = { strength: 16, vitality: 13, agility: 17, dexterity: 14, insight: 13, wisdom: 4 }

export const ZHANGLIE: OpponentDef = {
    id: 'zhanglie',
    name: '铁枪·张烈',
    story: '军旅出身，退伍后加入了那个组织。你的老战友们——那些还在追查真相的人——一个接一个消失了。他是最后一个活的。',
    weapon: 'long_spear',
    targetAttrs: ZHANGLIE_ATTRS,
    rewards: [
        action('pursuit_thrust'),
        passive('iron_bone'),
        artifact('hydraulic_leg'),
        artifact('heart_pump'),
        artifact('neural_net'),
        artifact('blood_thorn_ring'),
        action('thrust'),
        weapon('iron_spear'),
        action('rod_sweep'),
        action('return_spear'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'pursuit_thrust', triggerId: 'on_bleed' },
        // { actionId: 'rod_sweep', triggerId: 'on_melee' },
    ],
    taunt: () => '别怨我。各为其主。',
}

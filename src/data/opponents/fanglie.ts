import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const FANGLIE_ATTRS = { strength: 16, vitality: 13, agility: 17, dexterity: 14, insight: 13, wisdom: 4 }

export const FANGLIE: OpponentDef = {
    id: 'fanglie',
    name: '铁枪·方烈',
    story: '军旅出身，退伍后加入了那个组织。你的老战友们——那些还在追查真相的人——一个接一个消失了。他是最后一个活的。',
    weapon: 'long_spear',
    targetAttrs: FANGLIE_ATTRS,
    rewards: [
        action('pursuit_thrust'),
        passive('iron_bone'),
        passive('ji_lie_zhi_lie'),
        artifact('hydraulic_leg'),
        artifact('nano_metal_heart'),
        artifact('neural_net'),
        artifact('blood_thorn_ring'),
        artifact('blood_thorn_earring'),
        action('thrust'),
        weapon('iron_spear'),
        action('rod_sweep'),
        action('return_spear'),
        // 12
    ],
    actionConfigs: [
        { actionId: 'pursuit_thrust', triggerId: 'on_bleed' },
        // { actionId: 'rod_sweep', triggerId: 'on_melee' },
    ],
    taunt: () => '别怨我。各为其主。',
}

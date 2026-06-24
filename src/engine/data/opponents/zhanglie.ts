import { type OpponentDef } from '.'
import { passive, artifact, action, weapon } from '../../systems/reward-pool'

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
        action('jab'),
        action('straight_punch'),
        action('thrust'),
        weapon('iron_spear'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'thrust' }, // AI 出招顺序
        { actionId: 'pursuit_thrust', triggerId: 'on_debuff' },
        { actionId: 'straight_punch', conditionId: 'on' }, // AI 出招顺序
        { actionId: 'jab' }, // AI 出招顺序
    ],
    taunt: () => '别怨我。各为其主。',
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

const ZHANGLIE_ATTRS = { strength: 16, vitality: 13, agility: 17, dexterity: 14, insight: 13, wisdom: 4 }

export const ZHANGLIE: OpponentDef = {
    id: 'zhanglie',
    name: '铁枪·张烈',
    story: '军旅出身，退伍后加入了那个组织。你的老战友们——那些还在追查真相的人——一个接一个消失了。他是最后一个活的。',
    taunt: '别怨我。各为其主。',
    targetAttrs: ZHANGLIE_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'zhanglie',
            '铁枪·张烈',
            'strong',
            'iron_spear',
            ZHANGLIE_ATTRS,
            [
                passive('iron_bone'),
                artifact('hydraulic_leg'),
                artifact('heart_pump'),
                artifact('neural_net'),
                action('thrust'),
                action('straight_punch'),
                action('jab'),
                // action('break_formation'),
            ],
            n,
            undefined,
            undefined,
            [
                { actionId: 'thrust' },
                { actionId: 'straight_punch' },
                { actionId: 'jab' },
                { actionId: 'pursuit_thrust', triggerId: 'on_debuff' },
            ],
        ),
}

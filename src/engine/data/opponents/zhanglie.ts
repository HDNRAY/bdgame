import { type OpponentDef, simpleGenerate, passive, implant, action } from './base'

export const ZHANGLIE: OpponentDef = {
    id: 'o1',
    name: '铁枪·张烈',
    generate: (n) =>
        simpleGenerate(
            'o1',
            '铁枪·张烈',
            'strong',
            'iron_spear',
            { strength: 16, vitality: 13, agility: 18, dexterity: 14, insight: 13, wisdom: 4 },
            [
                passive('iron_bone'),
                implant('titanium_arm'),
                implant('heart_pump'),
                implant('neural_net'),
                action('thrust'),
                // action('break_formation'),
            ],
            [{ condition: { type: 'on_debuff' }, actionId: 'pursuit_thrust' }],
            n,
        ),
}

import { OpponentDef, simpleGenerate, passive, implant, action } from './base'

export const ZHANGLIE: OpponentDef = {
    id: 'o1',
    name: '铁枪·张烈',
    generate: (n) =>
        simpleGenerate(
            'o1',
            '铁枪·张烈',
            'strong',
            'iron_spear',
            { strength: 18, vitality: 14, agility: 8, dexterity: 14, insight: 10, wisdom: 8 },
            [
                passive('iron_bone'),
                implant('titanium_arm'),
                implant('heart_pump'),
                implant('neural_net'),
                action('thrust'),
                action('break_formation'),
                action('pursuit_thrust'),
            ],
            [{ condition: { type: 'on_debuff' }, actionId: 'pursuit_thrust' }],
            n,
            ['strength', 'dexterity', 'vitality', 'agility', 'insight', 'wisdom'],
        ),
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

export const ZHANGLIE: OpponentDef = {
    id: 'zhanglie',
    name: '铁枪·张烈',
    generate: (n) =>
        simpleGenerate(
            'zhanglie',
            '铁枪·张烈',
            'strong',
            'iron_spear',
            { strength: 16, vitality: 13, agility: 18, dexterity: 14, insight: 13, wisdom: 4 },
            [
                passive('iron_bone'),
                artifact('titanium_arm'),
                artifact('heart_pump'),
                artifact('neural_net'),
                action('thrust'),
                // action('break_formation'),
            ],
            [{ condition: { type: 'on_debuff' }, actionId: 'pursuit_thrust' }],
            n,
        ),
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action, artifact } from '.'

export const BAIHU: OpponentDef = {
    id: 'baihu',
    name: '白狐·南宫',
    generate: (n) =>
        simpleGenerate(
            'baihu',
            '白狐·南宫',
            'swift',
            'frost_twin_blades',
            { strength: 16, vitality: 10, agility: 16, dexterity: 16, insight: 14, wisdom: 6 },
            [
                passive('ice_heart'),
                passive('frost_mastery'),
                artifact('frost_silk_robe'),
                action('frost_step'),
                action('guard'),
                action('light_slash'),
                action('heavy_slash'),
            ],
            [{ condition: { type: 'on_dodged' }, actionId: 'guard' }],
            n,
        ),
    aiOverrides: {},
}

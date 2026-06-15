import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, action, artifact } from '.'

export const SANGYUAN: OpponentDef = {
    id: 'sangyuan',
    name: '灵剑·桑原',
    generate: (n) =>
        simpleGenerate(
            'sangyuan',
            '灵剑·桑原',
            'strong',
            'bare_hands',
            { strength: 12, vitality: 20, agility: 8, dexterity: 18, insight: 10, wisdom: 4 },
            [
                artifact('qi_amplifier'),
                action('light_slash'),
                action('heavy_slash'),
                action('ciyuan_blade'),
                action('big_leap'),
            ],
            [],
            n,
        ),
    aiOverrides: {
        actionPriority: () => ['heavy_slash', 'light_slash'],
    },
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action, artifact } from '.'

const SANGYUAN_ATTRS = { strength: 12, vitality: 20, agility: 8, dexterity: 18, insight: 10, wisdom: 4 }

export const SANGYUAN: OpponentDef = {
    id: 'sangyuan',
    name: '灵剑·桑原',
    targetAttrs: SANGYUAN_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'sangyuan',
            '灵剑·桑原',
            'strong',
            'bare_hands',
            SANGYUAN_ATTRS,
            [
                passive('dimensional_blade_mastery'),
                artifact('qi_amplifier'),
                action('light_slash'),
                action('spirit_sword'),
                action('heavy_slash'),
                action('big_leap'),
            ],
            n,
            [
                { actionId: 'spirit_sword' },
                { actionId: 'heavy_slash' },
                { actionId: 'big_leap' },
                { actionId: 'light_slash', triggerId: 'on_dodged' },
            ],
        ),
    aiOverrides: {},
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action } from '.'

export const LIUXIGUA: OpponentDef = {
    id: 'liuxigua',
    name: '霸刀·西瓜',
    generate: (n) =>
        simpleGenerate(
            'liuxigua',
            '霸刀·西瓜',
            'strong',
            'overlord_blade',
            { strength: 14, vitality: 10, agility: 20, dexterity: 16, insight: 12, wisdom: 4 },
            [
                passive('momentum_mastery'),
                passive('overlord_art'),
                action('spinning_slash'),
                action('cyclone_slash'),
                action('little_fist'),
                action('sky_burner'),
                action('retrieve_blade'),
                action('shadow_kick'),
            ],
            [],
            n,
        ),
}

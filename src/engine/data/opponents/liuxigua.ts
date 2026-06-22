import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action } from '.'

const LIUXIGUA_ATTRS = { strength: 14, vitality: 10, agility: 20, dexterity: 15, insight: 12, wisdom: 4 }

export const LIUXIGUA: OpponentDef = {
    id: 'liuxigua',
    name: '霸刀·西瓜',
    targetAttrs: LIUXIGUA_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'liuxigua',
            '霸刀·西瓜',
            'strong',
            'overlord_blade',
            LIUXIGUA_ATTRS,
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
            n,
        ),
}

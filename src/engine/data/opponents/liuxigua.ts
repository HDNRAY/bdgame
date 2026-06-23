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
                action('spinning_slash'),
                passive('momentum_mastery'),
                passive('overlord_art'),
                action('little_fist'),
                action('shadow_kick'),
                action('cyclone_slash'),
                action('sky_burner'),
                action('retrieve_blade'),
            ],
            n,
        ),
}

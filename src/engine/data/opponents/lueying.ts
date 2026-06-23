import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

const LUEYING_ATTRS = { strength: 6, vitality: 10, agility: 16, dexterity: 16, insight: 16, wisdom: 12 }

export const LUEYING: OpponentDef = {
    id: 'lueying',
    name: '掠影·无名',
    targetAttrs: LUEYING_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'lueying',
            '掠影·无名',
            'swift',
            'dagger',
            LUEYING_ATTRS,
            [
                action('gash'),
                passive('ordinary_training'),
                artifact('poison_coating'),
                artifact('western_poison'),
                action('kick'),
                action('dart_throw'),
            ],
            n,
            [
                { actionId: 'gash' },
                { actionId: 'sand_throw', triggerId: 'on_dodged' },
                { actionId: 'dart_throw', triggerId: 'on_dodge' },
                { actionId: 'kick', triggerId: 'on_parry' },
            ],
        ),
}

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
            'military_dagger',
            LUEYING_ATTRS,
            [
                passive('ordinary_training'),
                artifact('poison_coating'),
                artifact('western_poison'),
                action('gash'),
                action('kick'),
                action('dart_throw'),
            ],
            [
                {
                    condition: { type: 'on_dodged' },
                    actionId: 'sand_throw',
                },
                { condition: { type: 'on_dodge' }, actionId: 'dart_throw' },
                { condition: { type: 'on_parry' }, actionId: 'kick' },
            ],
            n,
        ),
}

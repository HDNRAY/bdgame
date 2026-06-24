import { type OpponentDef } from '.'
import { passive, artifact, action } from '../../systems/reward-pool'

const LUEYING_ATTRS = { strength: 6, vitality: 10, agility: 16, dexterity: 16, insight: 16, wisdom: 12 }

export const LUEYING: OpponentDef = {
    id: 'lueying',
    name: '掠影·无名',
    weapon: 'dagger',
    targetAttrs: LUEYING_ATTRS,
    rewards: [
        action('gash'),
        passive('ordinary_training'),
        artifact('poison_coating'),
        artifact('western_poison'),
        action('kick'),
        action('dart_throw'),
        action('sand_throw'),
    ],
    actionConfigs: [
        { actionId: 'sand_throw', triggerId: 'on_dodged' },
        { actionId: 'dart_throw', triggerId: 'on_dodge' },
        { actionId: 'kick', triggerId: 'on_parry' },
    ],
}

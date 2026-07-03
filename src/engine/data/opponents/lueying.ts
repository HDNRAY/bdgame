import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../util/reward-utils'

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
        artifact('soft_hedgehog_mail'),
        action('sword_thrust'),
        action('kick'),
        action('dart_throw'),
        action('sand_throw'),
        // 9
    ],
    actionConfigs: [
        { actionId: 'gash' }, // AI 出招顺序
        { actionId: 'sword_thrust' }, // AI 出招顺序
        { actionId: 'sand_throw', triggerId: 'on_dodged' },
        { actionId: 'dart_throw', triggerId: 'on_dodge' },
        { actionId: 'gash', triggerId: 'on_parry' },
    ],
}

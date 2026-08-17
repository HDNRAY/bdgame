import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const LUEYING_ATTRS = { strength: 6, vitality: 10, agility: 16, dexterity: 16, insight: 16, wisdom: 12 }

export const LUEYING: OpponentDef = {
    id: 'lueying',
    name: '李雪影',
    weapon: 'dagger',
    targetAttrs: LUEYING_ATTRS,
    battleStyle: 'melee',
    rewards: [
        action('gash'),
        passive('ordinary_training'),
        artifact('poison_coating'),
        artifact('shixiang_ruanjin_san'),
        artifact('western_poison'),
        artifact('soft_hedgehog_mail'),
        artifact('braid_blade'),
        artifact('tactical_pouch'),
        passive('frost_step'),
        action('dart_throw'),
        action('sand_throw'),
        weapon('special_forces_dagger'),
        // 12
    ],
    actionConfigs: [
        { actionId: 'sand_throw', triggerId: 'on_dodged' },
        { actionId: 'dart_throw', triggerId: 'on_dodge' },
        { actionId: 'gash', triggerId: 'on_parry' },
    ],
}

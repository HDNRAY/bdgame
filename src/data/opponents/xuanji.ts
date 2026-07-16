import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const XUANJI_ATTRS = { strength: 6, vitality: 10, agility: 12, dexterity: 15, insight: 15, wisdom: 18 }

export const XUANJI: OpponentDef = {
    id: 'xuanji',
    name: '御物·玄机',
    weapon: 'tri_orb',
    targetAttrs: XUANJI_ATTRS,
    rewards: [
        action('qi_bolt'),
        passive('spirit_resonance'),
        artifact('floating_eye'),
        artifact('qi_guard'),
        artifact('iron_will'),
        artifact('ap_boost'),
        artifact('flying_lion'),
        action('restore_ap'),
        action('summon_haste'),
        action('agility_steal'),
        // 10 + 1
    ],
    actionConfigs: [
        { actionId: 'qi_bolt' },
        { actionId: 'restore_ap', triggerId: 'on_parry' },
        { actionId: 'summon_haste', triggerId: 'on_dodge' },
        { actionId: 'agility_steal', triggerId: 'on_hit' },
    ],
}

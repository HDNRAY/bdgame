import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../util/reward-utils'

const QILAN_ATTRS = { strength: 12, vitality: 10, agility: 15, dexterity: 14, insight: 14, wisdom: 15 }

export const QILAN: OpponentDef = {
    id: 'qilan',
    name: '雷法·奇岚',
    weapon: 'bare_hands',
    targetAttrs: QILAN_ATTRS,
    rewards: [
        action('palm_strike'),
        passive('godspeed'),
        passive('thunder_art'),
        action('electric_yoyo'),
        passive('zoldyck_art'),
        passive('golden_light'),
        action('lightning_speed'),
        passive('qiti_source'), // 炁体源流
        artifact('cinnabar_mole'), // 守宫砂
        action('thunder_storm'),
        // 10
    ],
    actionConfigs: [
        {
            actionId: 'electric_yoyo',
            triggerId: 'on_opponent_move_away',
        },
        {
            actionId: 'palm_strike',
            triggerId: 'on_parried',
        },
    ],
}

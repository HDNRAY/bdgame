import { type OpponentDef } from '.'
import { passive, artifact, action } from '../../systems/reward-pool'

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
        passive('zoldyck_art'),
        passive('qiti_source'),
        artifact('cinnabar_mole'),
        action('electric_yoyo'),
        action('lightning_speed'),
        action('thunder_storm'),
    ],
}

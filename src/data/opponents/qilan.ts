import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const QILAN_ATTRS = { strength: 14, vitality: 10, agility: 14, dexterity: 14, insight: 15, wisdom: 14 }

export const QILAN: OpponentDef = {
    id: 'qilan',
    name: '周奇岚',
    weapon: 'bare_hands',
    targetAttrs: QILAN_ATTRS,
    rewards: [
        action('liu_yang_zhang'),
        passive('godspeed'),
        passive('thunder_art'),
        action('electric_yoyo'),
        passive('zoldyck_art'),
        passive('golden_light'),
        action('lightning_speed'),
        passive('qiti_source'), // 炁体源流
        artifact('cinnabar_mole'), // 守宫砂
        action('thunder_storm'),
        passive('no_parry_style'),
        // 11
    ],
    actionConfigs: [
        {
            actionId: 'electric_yoyo',
            triggerId: 'on_opponent_move_away',
        },
        {
            actionId: 'liu_yang_zhang',
            triggerId: 'on_dodged',
        },
    ],
}

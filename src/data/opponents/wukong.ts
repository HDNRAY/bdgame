import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const WUKONG_ATTRS = { strength: 20, vitality: 10, agility: 14, dexterity: 16, insight: 10, wisdom: 4 }

export const WUKONG: OpponentDef = {
    id: 'wukong',
    name: '天命·孙悟',
    battleStyle: 'melee',
    weapon: 'qimei_staff',
    targetAttrs: WUKONG_ATTRS,
    rewards: [
        action('rod_thrust'),
        passive('stone_skin'),
        passive('hua_gun'),
        passive('qishier_bian'),
        artifact('fiery_eyes'),
        action('stand_rod_kick'),
        action('rod_cleave'),
        action('santou_liubi'),
        action('jindou'),
        weapon('dinghai_shen_tie'),
        // 10
    ],
    actionConfigs: [{ actionId: 'stand_rod_kick', triggerId: 'on_parried' }],
}

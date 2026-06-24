import { type OpponentDef } from '.'
import { passive, artifact, action, weapon } from '../../systems/reward-pool'

const WUKONG_ATTRS = { strength: 20, vitality: 10, agility: 13, dexterity: 16, insight: 10, wisdom: 5 }

export const WUKONG: OpponentDef = {
    id: 'wukong',
    name: '天命·悟空',
    battleStyle: 'melee',
    weapon: 'qimei_staff',
    targetAttrs: WUKONG_ATTRS,
    rewards: [
        action('rod_thrust'),
        passive('stone_skin'),
        passive('hua_gun'),
        passive('qishier_bian'),
        artifact('fiery_eyes'),
        action('rod_sweep'),
        action('rod_cleave'),
        action('santou_liubi'),
        action('jindou'),
        weapon('dinghai_shen_tie'),
    ],
    actionConfigs: [{ actionId: 'rod_sweep', triggerId: 'on_parried' }],
}

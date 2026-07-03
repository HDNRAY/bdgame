import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../util/reward-utils'

const WUKONG_ATTRS = { strength: 20, vitality: 10, agility: 13, dexterity: 16, insight: 10, wisdom: 5 }

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
        action('rod_sweep'),
        action('rod_cleave'),
        action('santou_liubi'),
        action('jindou'),
        weapon('dinghai_shen_tie'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'rod_thrust' }, // AI 出招顺序
        { actionId: 'rod_cleave' }, // AI 出招顺序
        { actionId: 'rod_sweep' }, // AI 出招顺序
        { actionId: 'santou_liubi' }, // AI 出招顺序
        { actionId: 'jindou' }, // AI 出招顺序
        { actionId: 'rod_sweep', triggerId: 'on_parried' },
    ],
}

import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const JIRAN_ATTRS = { strength: 14, vitality: 12, agility: 14, dexterity: 14, insight: 16, wisdom: 16 }

export const JIRAN: OpponentDef = {
    id: 'jiran',
    name: '姬然',
    story: '姬家后人，会长姬仲的孙女。每年寒暑假回青山镇修炼三个月，天然道种，哪怕只修三个月也不输同龄人。',
    battleStyle: 'mid',
    weapon: 'long_spear',
    targetAttrs: JIRAN_ATTRS,
    rewards: [
        action('pursuit_thrust'),
        passive('insight_awareness'),
        action('yi_dian_han_mang'),
        passive('guan_zi_zai_yan'),
        action('fen_cheng'),
        passive('hua_gun'),
        action('rod_sweep'),
        weapon('zhen_bei_ji'),
        action('ru_long'),
        action('dao_ma_dan'),

        artifact('innate_seed'),
        // 11
    ],
    actionConfigs: [
        {
            actionId: 'yi_dian_han_mang',
            conditionId: 'chill_blade_lt_2',
        },
        {
            actionId: 'pursuit_thrust',
            triggerId: 'on_dodged',
        },
    ],
    taunt: () => '',
}

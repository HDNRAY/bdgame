import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const HEIYUN_ATTRS = { strength: 8, vitality: 14, agility: 12, dexterity: 12, insight: 14, wisdom: 18 }

export const HEIYUN: OpponentDef = {
    id: 'heiyun',
    name: '小树',
    weapon: 'fei_jian',
    battleStyle: 'ranged',
    targetAttrs: HEIYUN_ATTRS,
    rewards: [
        action('qi_bolt_2'),
        passive('spirit_resonance'),
        action('ling_qi_guan_zhu'),
        passive('sword_intent_tempering'),
        action('condense_shield'),
        passive('momentum_mastery'),
        passive('drunken_step'),
        passive('sword_dominion'),
        artifact('bu_lao_quan'),
        action('one_night_dance'),
        artifact('flying_lion'),
        action('summon_haste'),
        weapon('fei_jian'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'ling_qi_guan_zhu', triggerId: 'on_dodge' },
        { actionId: 'condense_shield', triggerId: 'on_was_hit' },
        { actionId: 'summon_haste', triggerId: 'on_summon_hit' },
        {
            actionId: 'qi_bolt_2',
            triggerId: 'on_opponent_move_closer',
        },
    ],
}

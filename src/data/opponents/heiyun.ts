import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const HEIYUN_ATTRS = { strength: 8, vitality: 14, agility: 12, dexterity: 12, insight: 14, wisdom: 18 }

export const HEIYUN: OpponentDef = {
    id: 'heiyun',
    name: '小树',
    weapon: 'fei_jian',
    targetAttrs: HEIYUN_ATTRS,
    rewards: [
        action('qi_bolt'),
        passive('spirit_resonance'),
        passive('momentum_mastery'),
        passive('sword_intent_tempering'),
        passive('drunken_step'),
        passive('sword_dominion'),
        artifact('zhu_ye_qing'),
        action('one_night_dance'),
        action('ling_qi_guan_zhu'),
        action('condense_shield'),
        weapon('fei_jian'),
        // 11
    ],
    actionConfigs: [
        { actionId: 'ling_qi_guan_zhu', conditionId: 'always' },
        { actionId: 'condense_shield', triggerId: 'on_took_damage' },
        {
            actionId: 'qi_bolt',
            triggerId: 'on_opponent_move_away',
        },
    ],
}

import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../util/reward-utils'

const HEIYUN_ATTRS = { strength: 8, vitality: 14, agility: 12, dexterity: 12, insight: 14, wisdom: 18 }

export const HEIYUN: OpponentDef = {
    id: 'heiyun',
    name: '黑云·小树',
    weapon: 'fei_jian',
    targetAttrs: HEIYUN_ATTRS,
    rewards: [
        action('yi_night_fish_dragon'),
        passive('momentum_mastery'),
        passive('sword_intent_tempering'),
        passive('drunken_step'),
        passive('sword_dominion'),
        artifact('jiu_hu'),
        action('ling_qi_guan_zhu'),
        action('condense_shield'),
        // 8 + 1
    ],
    actionConfigs: [{ actionId: 'condense_shield', triggerId: 'on_took_damage' }],
}

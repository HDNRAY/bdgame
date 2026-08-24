import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const LAYUE_ATTRS = { strength: 14, vitality: 10, agility: 20, dexterity: 16, insight: 16, wisdom: 4 }

export const LAYUE: OpponentDef = {
    id: 'layue',
    name: '赵越',
    weapon: 'peach_sword',
    targetAttrs: LAYUE_ATTRS,
    battleStyle: 'mid',
    rewards: [
        action('cun_mang'),
        passive('last_sword'),
        action('nine_deaths_strike'),
        passive('sword_intent_tempering'),
        weapon('buer_sword'),
        action('cloud_hidden_sword'),
        weapon('fusi_sword'),
        passive('sword_dominion'),
        artifact('wisdom_talisman'),
        passive('tongtian'),
        artifact('innate_seed'),
        action('cang_niao_jian_fa'),
        // 剑丸
        // 12
    ],
    actionConfigs: [
        { actionId: 'cun_mang', triggerId: 'on_dodged' },
        { actionId: 'cloud_hidden_sword', triggerId: 'on_dodge' },
    ],
}

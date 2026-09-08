import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const ATTRS = { strength: 12, vitality: 10, agility: 16, dexterity: 16, insight: 10, wisdom: 14 }

export const ORANGE: OpponentDef = {
    id: 'orange',
    name: '橘子会',
    story: '橘子真的妹妹。她从小练的是忍术，可姐姐那种近乎本能的打法，她学不来。为了找自己的路，她走过很多地方，最后拜在花大师门下，学「无明之明」。',
    battleStyle: 'clinch',
    weapon: 'dagger',
    targetAttrs: ATTRS,
    rewards: [
        action('gash'),
        passive('wolf_hunting'),
        passive('blood_rage'),
        action('dart_throw'),
        passive('can_ying_bu'),
        weapon('ninja_sword'),
        artifact('ninja_tool_kit'),
        action('blaze_strike'),
        passive('no_light_wisdom'),
        action('yan_quan'),
        weapon('broken_blade'),
        action('horizontal_slash'),
        artifact('fen_shen_qiu'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'dart_throw', triggerId: 'on_dodge' },
        {
            actionId: 'horizontal_slash',
            triggerId: 'on_dodged',
        },
        {
            actionId: 'gash',
            triggerId: 'on_parried',
        },
    ],
}

import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const ATTRS = { strength: 12, vitality: 10, agility: 16, dexterity: 16, insight: 10, wisdom: 14 }

export const ORANGE: OpponentDef = {
    id: 'orange',
    name: '橘子会',
    story: '橘子真的妹妹。她从小练的是忍术，可姐姐那种近乎本能的打法，她学不来。为了找自己的路，她走过很多地方，最后拜在花大师门下，学「无明之明」。',
    battleStyle: 'melee',
    weapon: 'dagger',
    targetAttrs: ATTRS,
    rewards: [
        action('blaze_strike'),
        passive('wolf_hunting'),
        passive('blood_rage'),
        action('dart_throw'),
        passive('can_ying_bu'),
        weapon('ninja_sword'),
        artifact('ninja_tool_kit'),
        passive('no_light_wisdom'),
        action('yan_quan'),
        passive('ordinary_training'),
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
            actionId: 'blaze_strike',
            triggerId: 'on_parried',
        },
    ],
}

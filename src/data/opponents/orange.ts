import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const ATTRS = { strength: 12, vitality: 10, agility: 16, dexterity: 16, insight: 10, wisdom: 14 }

export const ORANGE: OpponentDef = {
    id: 'orange',
    name: '橘子会',
    story: '橘子真的妹妹。从小修习忍术，成年后发现自己对真正的功夫由衷地向往，而自己的天赋无法发挥姐姐那种近乎本能的作战方式，到处寻找适合自身的功法，直到她遇到花大师，目前跟随其学习无明之明。',
    battleStyle: 'mid',
    weapon: 'dagger',
    targetAttrs: ATTRS,
    rewards: [
        action('light_slash'),
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
            actionId: 'light_slash',
            triggerId: 'on_parried',
        },
    ],
}

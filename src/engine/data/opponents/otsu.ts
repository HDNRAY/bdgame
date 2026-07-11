import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../util/reward-utils'

const OTSU_ATTRS = { strength: 8, vitality: 8, agility: 18, dexterity: 18, insight: 16, wisdom: 4 }

export const OTSU: OpponentDef = {
    id: 'otsu',
    name: '橘子·真会',
    story: '归海楼弟子，枪术惊世却无争强之心。三节枪使得出神入化，可在守势与攻势间自如切换。她出手从来不是为了自己——有人需要她赢，她便赢。',
    battleStyle: 'melee',
    weapon: 'long_spear',
    targetAttrs: OTSU_ATTRS,
    rewards: [
        action('light_slash'),
        passive('sekai_heroism'),
        passive('combat_instinct'),
        passive('wolf_hunting'),
        action('rising_slash'),
        action('spinning_slash'),
        weapon('three_section_spear'),
        passive('insight_awareness'),
        passive('spear_stance_mastery'),
        artifact('nv_er_hong'),
        // 10
    ],
    actionConfigs: [
        {
            actionId: '_spear_throw',
            triggerId: 'on_opponent_move_away',
        },
        {
            actionId: 'spinning_slash',
            triggerId: 'on_opponent_move_closer',
        },
        {
            actionId: 'light_slash',
            triggerId: 'on_parried',
        },
        {
            actionId: 'rising_slash',
            triggerId: 'on_parry',
        },
    ],
}

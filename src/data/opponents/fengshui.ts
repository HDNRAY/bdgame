import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const ATTRS = { strength: 15, vitality: 8, agility: 17, dexterity: 17, insight: 14, wisdom: 4 }

export const FENGSHUI: OpponentDef = {
    id: 'fengshui',
    name: '风水·四娘',
    story: '短发，黑铁面具只露嘴和下巴，腰悬雁翎刀「惊鸿」。别人问她为啥戴面具，她咧嘴一笑："长得太好看，怕你分心，刀太快怕你看不清。"',
    weapon: 'dagger',
    targetAttrs: ATTRS,
    rewards: [
        action('horizontal_slash'),
        passive('no_parry_style'),
        action('swift_step'),
        passive('quick_glance'),
        action('rising_slash'),
        weapon('yanling_blade'),
        artifact('nv_er_hong'),
        passive('draw_sword_cut_water'),
        action('spinning_slash'),
        artifact('iron_mask'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'swift_step' },
        { actionId: 'horizontal_slash' },
        { actionId: 'spinning_slash' },
        { actionId: 'rising_slash' },
        { actionId: 'follow_the_current' },
        { actionId: 'swift_step', triggerId: 'on_opponent_move_away' },
    ],
    taunt: () => '看什么看？没见过漂亮姑娘打架？',
}

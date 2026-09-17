import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const JUNSHI_ATTRS = { strength: 4, vitality: 16, agility: 10, dexterity: 14, insight: 16, wisdom: 20 }

export const JUNSHI: OpponentDef = {
    id: 'junshi',
    name: '梅用',
    story: '组织中的推演第一人。掌握着组织的所有计划——他算得动所有人，没人算得动他。',
    weapon: 'floating_silk',
    battleStyle: 'ranged',
    targetAttrs: JUNSHI_ATTRS,
    rewards: [
        action('qi_bolt'),
        passive('beiming'),
        action('restore_ap'),
        artifact('neural_net'),
        artifact('power_furnace'),
        artifact('nano_metal_heart'),
        action('condense_shield'),
        action('agility_steal'),
        action('summon_haste'),
        action('wan_fa_gui_yi'),
        weapon('floating_silk'),
        // 天生道种
        artifact('innate_seed'),
        action('shi_qi'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'condense_shield', triggerId: 'on_was_hit' },
        { actionId: 'agility_steal', triggerId: 'on_dodged' },
        { actionId: 'summon_haste', triggerId: 'on_parried' },
        { actionId: 'restore_ap', triggerId: 'on_summon_hit' },
        { actionId: 'shi_qi', triggerId: 'on_opponent_move_closer' },
    ],
    taunt: () => '一切都在掌控之中。',
}

import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const JUNSHI_ATTRS = { strength: 4, vitality: 16, agility: 10, dexterity: 14, insight: 16, wisdom: 20 }

export const JUNSHI: OpponentDef = {
    id: 'junshi',
    name: '梅用',
    story: '组织中推演最强者，天生道种。掌握着组织的所有计划。在天生道种线中，你会发现TA是你师兄的首领。',
    weapon: 'floating_silk',
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
        // 12
    ],
    actionConfigs: [
        { actionId: 'condense_shield', triggerId: 'on_took_damage' },
        { actionId: 'agility_steal', triggerId: 'on_dodged' },
        { actionId: 'summon_haste', triggerId: 'on_parried' },
        { actionId: 'restore_ap', triggerId: 'on_summon_hit' },
    ],
    taunt: () => '一切都在掌控之中。',
}

import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const JUNSHI_ATTRS = { strength: 4, vitality: 16, agility: 10, dexterity: 14, insight: 16, wisdom: 20 }

export const JUNSHI: OpponentDef = {
    id: 'junshi',
    name: '无用·艾迪',
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
        // 天生道种
        artifact('innate_seed'),
        // 10 + 1
    ],
    actionConfigs: [
        { actionId: 'condense_shield', triggerId: 'on_took_damage' },
        { actionId: 'agility_steal', triggerId: 'on_was_hit' },
        { actionId: 'summon_haste', triggerId: 'on_hit' },
        { actionId: 'restore_ap', triggerId: 'on_dodged' },
    ],
    taunt: () => '一切都在掌控之中。',
}

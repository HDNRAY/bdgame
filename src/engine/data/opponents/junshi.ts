import { type OpponentDef } from '.'
import { passive, artifact, action, weapon } from '../../systems/reward-pool'

const JUNSHI_ATTRS = { strength: 15, vitality: 12, agility: 16, dexterity: 18, insight: 20, wisdom: 8 }

export const JUNSHI: OpponentDef = {
    id: 'junshi',
    name: '军师',
    story: '组织中推演最强者，天生道种。掌握着组织的所有计划。在天生道种线中，你会发现TA是你师兄的首领。',
    weapon: 'long_spear',
    targetAttrs: JUNSHI_ATTRS,
    rewards: [
        action('pursuit_thrust'),
        passive('prophecy_sight'),
        artifact('mind_palace'),
        weapon('sage_spear'),
        // 占位
        // 天生道种
        artifact('innate_seed'),
    ],
    actionConfigs: [
        { actionId: 'pursuit_thrust' },
        // 占位
    ],
    taunt: () => '一切都在掌控之中。',
}

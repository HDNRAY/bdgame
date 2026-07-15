import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../util/reward-utils'

const QIANXING_ATTRS = {
    strength: 14,
    vitality: 16,
    agility: 10,
    dexterity: 16,
    insight: 10,
    wisdom: 12,
}

export const QIANXING: OpponentDef = {
    id: 'qianxing',
    name: '天工·千星',
    story: '天工坊主人，神铁、千机、阿赖耶识的锻造者。以炁驱动的电磁锤纵横战场，雷火交加。每个人一生只能给他下一个订单，做不做全凭他意。',
    weapon: 'engine_hammer',
    targetAttrs: QIANXING_ATTRS,
    rewards: [
        weapon('engine_hammer'),
        action('hammer_swing'),
        artifact('tactical_goggles'),
        artifact('nano_exoskeleton'),
        artifact('jet_drive'),
        action('hammer_smash'),
        artifact('energy_shield'),
        passive('qi_electric_conversion'),
        action('flash'),
        artifact('qi_battery'),
        // 10
    ],
    actionConfigs: [],
    taunt: () => '哼，这活儿，我不接。',
}

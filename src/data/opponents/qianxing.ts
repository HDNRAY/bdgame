import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

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
    story: '天工坊的主人。他打的兵器，镇上有头有脸的人都要排队等。他有一条规矩：每个人一辈子只许找他下一次单——接不接，全凭他意。',
    weapon: 'qimei_staff',
    battleStyle: 'melee',
    targetAttrs: QIANXING_ATTRS,
    rewards: [
        weapon('engine_hammer'),
        action('hammer_swing'),
        artifact('tactical_goggles'),
        artifact('nano_exoskeleton'),
        artifact('jet_drive'),
        action('thunder_strike'),
        artifact('energy_shield'),
        passive('qi_electric_conversion'),
        action('flash'),
        artifact('qi_battery'),
        action('cang_niao_jian_fa'),
        passive('qian_chui_bai_lian'),
        artifact('ci_magnetic_coil'),
        // 13
    ],
    actionConfigs: [
        {
            actionId: 'hammer_swing',
            triggerId: 'on_dodge',
        },
    ],
    taunt: () => '哼，这活儿，我不接。',
}

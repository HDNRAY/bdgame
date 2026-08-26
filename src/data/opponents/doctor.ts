import { type OpponentDef } from '.'
import { action, artifact, weapon } from '../../engine/util/reward-utils'

const DOCTOR_ATTRS = { strength: 4, vitality: 10, agility: 6, dexterity: 18, insight: 16, wisdom: 18 }

export const DOCTOR: OpponentDef = {
    id: 'doctor',
    name: '博士·德克',
    story: '义体研究部核心人物，专研义体与战斗芯片开发。日常坐轮椅。以无人机代替御物作战，炁只作为能源，控制全靠脑机芯片。',
    battleStyle: 'ranged',
    weapon: 'hover_drone',
    targetAttrs: DOCTOR_ATTRS,
    rewards: [
        action('summon_haste'),
        artifact('doctor_chip'),
        artifact('sonic_generator'),
        artifact('synthetic_lung'),
        action('wan_fa_gui_yi'),
        artifact('power_furnace'),
        artifact('mechanical_eye'),
        action('drone_paralyze'),
        artifact('combat_armor'),
        artifact('wheelchair_lightness'),
        weapon('hover_drone'),
        artifact('neural_net'),
        artifact('cochlear_implant'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'drone_paralyze', triggerId: 'on_summon_hit' },
        { actionId: 'summon_haste', triggerId: 'on_dodged' },
        { actionId: '_sonic_wave', triggerId: 'on_parried' },
    ],
}

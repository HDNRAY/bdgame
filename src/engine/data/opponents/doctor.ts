import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../util/reward-utils'

const DOCTOR_ATTRS = { strength: 4, vitality: 10, agility: 6, dexterity: 18, insight: 16, wisdom: 18 }

export const DOCTOR: OpponentDef = {
    id: 'doctor',
    name: '博士·德克',
    story: '义体研究部核心人物，专研义体与战斗芯片开发。日常坐轮椅。以无人机代替御物作战，炁只作为能源，控制全靠脑机芯片。',
    battleStyle: 'ranged',
    weapon: 'hover_drone',
    targetAttrs: DOCTOR_ATTRS,
    rewards: [
        artifact('doctor_chip'),
        action('drone_strike'),
        artifact('floating_eye'),
        action('drone_barrage'),
        action('summon_haste'),
        artifact('power_furnace'),
        artifact('mechanical_eye'),
        action('scan_analysis'),
        artifact('combat_armor'),
        passive('wheelchair_lightness'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'scan_analysis', triggerId: 'turn_start' },
        { actionId: 'summon_haste', triggerId: 'on_hit' },
    ],
}

import { type OpponentDef } from '.'
import { action, artifact, weapon } from '../../engine/util/reward-utils'

const DOCTOR_ATTRS = { strength: 4, vitality: 10, agility: 6, dexterity: 18, insight: 16, wisdom: 18 }

export const DOCTOR: OpponentDef = {
    id: 'doctor',
    name: '博士·德克',
    story: '义体研究部核心人物，一辈子泡在义体与战斗芯片上。他坐着轮椅，出手的从来不是他自己——是几架无人机。',
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

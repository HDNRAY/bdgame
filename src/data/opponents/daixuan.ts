import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const DAIXUAN_ATTRS = { strength: 14, vitality: 10, agility: 14, dexterity: 16, insight: 16, wisdom: 8 }

export const DAIXUAN: OpponentDef = {
    id: 'daixuan',
    name: '药屋黛玄',
    story: '炼炁名门药屋之后，现任特殊事件调查科科长。曾因某次事件失聪，后以惊人意志锻炼视觉与触觉弥补。佩戴人造耳蜗，集成翻译与通讯模块。处事冷静，少言寡语，但出手极为犀利。武器是一根纳米变形棍「千机」；自创的「落英神剑」，见过的人不多。',
    weapon: 'qimei_staff',
    targetAttrs: DAIXUAN_ATTRS,
    battleStyle: 'melee',
    rewards: [
        action('yu_xiao_jian_fa'),
        passive('ningqi_jue'),
        passive('enhanced_vision'),
        weapon('qianji'),
        action('flick'),
        passive('ni_zhuan_jing_mai'),
        action('bi_hai_chao_sheng_qu'),
        artifact('cochlear_implant'),
        passive('luo_ying_shen_jian'),
        action('yi_hui'),
        passive('ling_ao_bu'),
        artifact('yao_xin_shi'),
        artifact('other_mountain'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'yi_hui' },
        { actionId: 'bi_hai_chao_sheng_qu', condition: { type: 'distance_greater_than', meters: 4 } },
        { actionId: 'flick', triggerId: 'on_opponent_move_away' },
        { actionId: 'yu_xiao_jian_fa', triggerId: 'on_parry' },
    ],
    taunt: () => '……',
}

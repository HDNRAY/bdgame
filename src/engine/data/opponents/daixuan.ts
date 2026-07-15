import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../util/reward-utils'

const DAIXUAN_ATTRS = { strength: 14, vitality: 11, agility: 14, dexterity: 16, insight: 16, wisdom: 7 }

export const DAIXUAN: OpponentDef = {
    id: 'daixuan',
    name: '药屋·黛玄',
    story: '炼炁名门药屋之后，现任特殊事件调查科科长。曾因某次事件失聪，后以惊人意志锻炼视觉与触觉弥补。佩戴人造耳蜗，集成翻译与通讯模块。处事冷静，少言寡语，但出手极为犀利。武器「千机」为纳米变形棍，自创「落英神剑」以炁寄存印记、五层引爆。',
    weapon: 'qimei_staff',
    targetAttrs: DAIXUAN_ATTRS,
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
        // 10
    ],
    actionConfigs: [{ actionId: 'flick', triggerId: 'on_opponent_move_away' }],
    taunt: () => '……',
}

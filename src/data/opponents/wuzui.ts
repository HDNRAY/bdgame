import { type OpponentDef } from '.'
import { action, passive, artifact } from '../../engine/util/reward-utils'

const WUZUI_ATTRS = { strength: 10, vitality: 20, agility: 14, dexterity: 14, insight: 10, wisdom: 8 }

export const WUZUI: OpponentDef = {
    id: 'wuzui',
    name: '酒鬼·无志',
    battleStyle: 'melee',
    weapon: 'bare_hands',
    targetAttrs: WUZUI_ATTRS,
    rewards: [
        action('ba_gua_you_shen_zhang'),
        passive('shenxing_baibian'),
        passive('jiu_yang_shen_gong'),
        passive('hun_yuan_gong'),
        action('wan_liu_gui_zong'),
        passive('qian_kun_da_nuo_yi'),
        artifact('shao_dao_zi'),
        passive('zui_quan'),
        artifact('hui_xiang_dou'),
        action('hun_yuan_zhang'),
        // 10
    ],
    actionConfigs: [],
}

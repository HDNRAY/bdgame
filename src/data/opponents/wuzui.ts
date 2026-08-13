import { type OpponentDef } from '.'
import { action, passive, artifact } from '../../engine/util/reward-utils'

const WUZUI_ATTRS = { strength: 12, vitality: 20, agility: 12, dexterity: 14, insight: 10, wisdom: 8 }

export const WUZUI: OpponentDef = {
    id: 'wuzui',
    name: '酒鬼·无志',
    battleStyle: 'melee',
    weapon: 'bare_hands',
    targetAttrs: WUZUI_ATTRS,
    rewards: [
        action('qi_bolt'),
        passive('shenxing_baibian'),
        passive('jiu_yang_shen_gong'),
        passive('hun_yuan_gong'),
        action('wan_liu_gui_zong'),
        passive('qian_kun_da_nuo_yi'),
        artifact('shao_dao_zi'),
        passive('zui_quan'),
        artifact('hui_xiang_dou'),
        action('hun_yuan_zhang'),
        artifact('ba_wang_zui'),
        // 11
    ],
    actionConfigs: [
        {
            actionId: 'qi_bolt',
            triggerId: 'on_dodge',
        },
    ],
}

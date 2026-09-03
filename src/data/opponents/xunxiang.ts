import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const XUNXIANG_ATTRS = { strength: 8, vitality: 6, agility: 14, dexterity: 14, insight: 14, wisdom: 20 }

export const XUNXIANG: OpponentDef = {
    id: 'xunxiang',
    name: '凤寻香',
    battleStyle: 'mid',
    weapon: 'bare_hands',
    targetAttrs: XUNXIANG_ATTRS,
    rewards: [
        action('push_palm'),
        action('throwing_knife'),
        passive('lingxi_finger'),
        passive('feng_wu_jiu_tian'),
        action('steal_artifact'),
        action('dian_xue'),
        passive('li_wu_xu_fa'),
        action('push_hand'),
        passive('no_way_win'),
        passive('ling_long_xin_qiao'),
        action('tian_wai_fei_xian'),
        artifact('zhu_ye_qing'),
        passive('ni_zhuan_jing_mai'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'dian_xue', triggerId: 'on_dodge' },
        { actionId: 'throwing_knife', triggerId: 'on_dodged' },
        { actionId: 'push_hand', triggerId: 'on_parry' },
        { actionId: 'push_palm', triggerId: 'on_opponent_move_closer' },
        { actionId: 'steal_artifact', triggerId: 'on_turn_start' },
    ],
}

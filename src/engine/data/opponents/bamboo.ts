import { type OpponentDef } from '.'
import { action, passive, weapon, artifact } from '../../util/reward-utils'

const BAMBOO_ATTRS = { strength: 13, vitality: 13, agility: 10, dexterity: 18, insight: 16, wisdom: 6 }

export const BAMBOO: OpponentDef = {
    id: 'bamboo',
    name: '飞虎·竹子',
    story: '幼年在佛寺修行，后被逐出山门。如今在镇上开了家药铺"宝字堂"，兼行医济世。一根竹棍从不离身。',
    battleStyle: 'melee',
    weapon: 'qimei_staff',
    targetAttrs: BAMBOO_ATTRS,
    rewards: [
        action('rod_thrust'),
        passive('jing_luo_chu_jian'),
        action('rod_sweep'),
        action('shadow_kick'),
        passive('dian_xue_passive'),
        artifact('qing_nang_san_bao'),
        passive('ru_yi_jin'),
        action('rod_lift'),
        action('po_lang_gun_fa'),
        weapon('po_lang_zhu_zhi'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'rod_thrust' },
        { actionId: 'rod_lift' },
        { actionId: 'rod_sweep', triggerId: 'on_parried' },
        { actionId: 'po_lang_gun_fa' },
        { actionId: 'shadow_kick' },
    ],
}

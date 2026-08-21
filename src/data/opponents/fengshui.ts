import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const ATTRS = { strength: 15, vitality: 12, agility: 16, dexterity: 16, insight: 14, wisdom: 4 }

export const FENGSHUI: OpponentDef = {
    id: 'fengshui',
    name: '风似水',
    story: '短发，黑铁面具只露嘴和下巴，腰悬雁翎刀「惊鸿」。别人问她为啥戴面具，她咧嘴一笑："长得太好看，怕你分心，刀太快怕你看不清。"',
    weapon: 'dagger',
    targetAttrs: ATTRS,
    rewards: [
        action('horizontal_slash'), // 横斩
        passive('no_parry_style'), // 招架转闪避
        action('swift_step'), // 位移+身法buff
        passive('quick_glance'), // 爆伤+耗缠大招
        action('rising_slash'), // 挑斩
        weapon('yanling_blade'), // 雁翎刀 1身法 1力道 2灵巧
        artifact('nv_er_hong'), // hot酒
        passive('draw_sword_cut_water'), // 不同招式连击增伤buff
        passive('dan_dao_fa_xuan'), // 闪避后加暴击率
        action('spinning_slash'), // 旋斩
        artifact('iron_mask'), // 奇物 3洞察 2推演
        // 11
    ],
    actionConfigs: [{ actionId: 'rising_slash', triggerId: 'on_dodged' }],
    taunt: () => '看什么看？没见过漂亮姑娘打架？',
}

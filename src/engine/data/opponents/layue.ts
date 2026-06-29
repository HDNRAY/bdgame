import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../systems/reward-pool'

const LAYUE_ATTRS = { strength: 12, vitality: 8, agility: 20, dexterity: 16, insight: 16, wisdom: 8 }

export const LAYUE: OpponentDef = {
    id: 'layue',
    name: '什么·腊月',
    weapon: 'dual_swords',
    targetAttrs: LAYUE_ATTRS,
    rewards: [
        action('cun_mang'),
        weapon('qing_shan_swords'),
        passive('nine_deaths'),
        action('nine_deaths_strike'),
        artifact('wisdom_talisman'),
        passive('sword_dominion'),
        // 其实是第一个，但是别人第一节点选的纯背景，所以这个放到最后，没有作用，通过simpleGenerate来获取效果
        artifact('innate_seed'),
        // 7
    ],
    actionConfigs: [
        { actionId: 'nine_deaths_strike' }, // AI 出招顺序
        { actionId: 'nine_deaths_strike', triggerId: 'on_parry' },
        { actionId: 'cun_mang', triggerId: 'on_parried' },
    ],
}

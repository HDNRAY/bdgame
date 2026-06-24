import { type OpponentDef } from '.'
import { weapon } from '../../systems/reward-pool'

const LAYUE_ATTRS = { strength: 12, vitality: 8, agility: 20, dexterity: 16, insight: 16, wisdom: 8 }

export const LAYUE: OpponentDef = {
    id: 'layue',
    name: '什么·腊月',
    weapon: 'dual_swords',
    targetAttrs: LAYUE_ATTRS,
    rewards: [
        { type: 'action', id: 'cun_mang', name: 'cun_mang', description: '', tags: [] },
        { type: 'passive', id: 'sword_dominion', name: 'sword_dominion', description: '', tags: [] },
        weapon('qing_shan_swords'),
        { type: 'passive', id: 'nine_deaths', name: 'nine_deaths', description: '', tags: [] },
        { type: 'action', id: 'nine_deaths_strike', name: 'nine_deaths_strike', description: '', tags: [] },
        { type: 'artifact', id: 'wisdom_talisman', name: 'wisdom_talisman', description: '', tags: [] },
        // 其实是第一个，但是别人第一节点选的纯背景，所以这个放到最后，没有作用，通过simpleGenerate来获取效果
        { type: 'artifact', id: 'innate_seed', name: 'innate_seed', description: '', tags: [] },
    ],
    actionConfigs: [
        { actionId: 'nine_deaths_strike' }, // AI 出招顺序
        { actionId: 'nine_deaths_strike', triggerId: 'on_parry' },
        { actionId: 'cun_mang', triggerId: 'on_parried' },
    ],
}

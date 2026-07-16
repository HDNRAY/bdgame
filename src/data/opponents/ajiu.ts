import { OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../util/reward-utils'

const AJIU_ATTRS = { strength: 14, vitality: 10, agility: 18, dexterity: 16, insight: 14, wisdom: 4 }

export const AJIU: OpponentDef = {
    id: 'ajiu',
    name: '断刀·阿九',
    story: '青山镇孤儿院里出来的孩子。没人知道TA的父母是谁，只知道TA那把断刀从不离手。沉默，寡言，但比谁都可靠。',
    weapon: 'qingfeng_jian',
    targetAttrs: AJIU_ATTRS,
    rewards: [
        action('light_slash'),
        weapon('broken_blade'),
        action('spirit_sword'),
        passive('shenxing_baibian'),
        action('blaze_strike'),
        artifact('titanium_arm'),
        artifact('muscle_boost'),
        action('horizontal_slash'),
        passive('xuannv_sword'),
        action('guard'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'spirit_sword' }, // AI 出招顺序
        { actionId: 'light_slash' }, // AI 出招顺序
        { actionId: 'heavy_slash' }, // AI 出招顺序
        { actionId: 'blaze_strike' }, // AI 出招顺序
        { actionId: 'guard' }, // AI 出招顺序
        { actionId: '_arm_explosion', triggerId: 'hp_below_30' },
    ],
    taunt: () => '……让开。',
}

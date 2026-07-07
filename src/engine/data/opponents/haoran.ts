import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../util/reward-utils'

const ATTRS = { strength: 12, vitality: 20, agility: 8, dexterity: 18, insight: 10, wisdom: 4 }

export const HAORAN: OpponentDef = {
    id: 'haoran',
    name: '浩然·潮生',
    weapon: 'qingfeng_jian',
    targetAttrs: ATTRS,
    rewards: [
        action('spirit_sword'),
        artifact('qi_amplifier'),
        action('qi_slash'),
        // 10
    ],
    actionConfigs: [],
}

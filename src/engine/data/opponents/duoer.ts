import { type OpponentDef } from '.'
import { passive, artifact, action, weapon } from '../../systems/reward-pool'

const DUOER_ATTRS = { strength: 14, vitality: 11, agility: 18, dexterity: 17, insight: 15, wisdom: 5 }

export const DUOER: OpponentDef = {
    id: 'duoer',
    name: '朵儿',
    story: '小时候最好的玩伴。后来被招入了**学校修习。二阶段重逢，共处一段时日后，目睹了她的另一面——那个在黑暗里执行任务的朵儿。',
    weapon: 'qingfeng_jian',
    targetAttrs: DUOER_ATTRS,
    rewards: [
        action('light_slash'),
        passive('poison_mastery'),
        artifact('venom_gland'),
        weapon('poison_blade'),
        // 占位
    ],
    actionConfigs: [
        { actionId: 'light_slash' },
        // 占位
    ],
    taunt: () => '对不起……我没得选。',
}

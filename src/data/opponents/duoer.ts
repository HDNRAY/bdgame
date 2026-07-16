import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../util/reward-utils'

const DUOER_ATTRS = { strength: 4, vitality: 20, agility: 18, dexterity: 12, insight: 10, wisdom: 8 }

export const DUOER: OpponentDef = {
    id: 'duoer',
    name: '圣女·朵儿',
    story: '小时候最好的玩伴。后来被招入了**学校修习。二阶段重逢，共处一段时日后，目睹了她的另一面——那个在黑暗里执行任务的朵儿。',
    weapon: 'dagger',
    battleStyle: 'melee',
    targetAttrs: DUOER_ATTRS,
    rewards: [
        artifact('gu_tong_body'),
        passive('yu_du_shu'),
        action('palm_strike'),
        artifact('venom_gland'),
        action('poison_detonate'),
        action('blood_droplet'),
        artifact('combat_chip'),
        artifact('marrow_pump'),
        action('straight_punch'),
        action('kick'),
        // 10
    ],
    actionConfigs: [
        { actionId: 'blood_droplet', triggerId: 'on_opponent_move_away' }, // AI 出招顺序
        { actionId: 'kick', triggerId: 'on_dodge' },
    ],
    taunt: () => '对不起……我没得选。',
}

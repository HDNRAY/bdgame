import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const DUOER_ATTRS = { strength: 4, vitality: 20, agility: 18, dexterity: 12, insight: 10, wisdom: 8 }

export const DUOER: OpponentDef = {
    id: 'duoer',
    name: '陶朵',
    story: '小时候最好的玩伴。后来被招入了**学校修习。二阶段重逢，共处一段时日后，目睹了她的另一面——那个在黑暗里执行任务的陶朵。',
    weapon: 'dagger',
    battleStyle: 'melee',
    targetAttrs: DUOER_ATTRS,
    rewards: [
        action('ba_gua_you_shen_zhang'),
        artifact('gu_tong_body'),
        passive('yu_du_shu'),
        artifact('venom_gland'),
        artifact('shi_gu'),
        passive('yi_ma_xin_yuan'),
        action('blood_droplet'),
        artifact('combat_chip'),
        artifact('marrow_pump'),
        action('blood_qi_protection'),
        action('rear_naked_choke'),
        action('poison_detonate'),
        action('kick'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'blood_droplet', triggerId: 'on_opponent_move_away' }, // AI 出招顺序
        { actionId: 'kick', triggerId: 'on_dodge' },
        { actionId: 'rear_naked_choke', conditionId: 'distance_lt_2' },
    ],
    taunt: () => '对不起……我没得选。',
}

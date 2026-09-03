import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const DUOER_ATTRS = { strength: 4, vitality: 20, agility: 18, dexterity: 12, insight: 10, wisdom: 8 }

export const DUOER: OpponentDef = {
    id: 'duoer',
    name: '陶朵',
    story: '小时候最好的玩伴。后来被招入了**学校修习。二阶段重逢，共处一段时日后，目睹了她的另一面——那个在黑暗里执行任务的陶朵。',
    weapon: 'dagger',
    battleStyle: 'clinch',
    targetAttrs: DUOER_ATTRS,
    rewards: [
        action('shadow_kick'),
        artifact('gu_tong_body'),
        passive('yu_du_shu'),
        artifact('venom_gland'),
        artifact('shi_gu'),
        passive('yi_ma_xin_yuan'),
        action('blood_droplet'),
        action('lion_roar'),
        artifact('combat_chip'),
        artifact('marrow_pump'),
        action('blood_qi_protection'),
        action('rear_naked_choke'),
        action('poison_detonate'),
        // 13
    ],
    actionConfigs: [
        { actionId: 'poison_detonate', conditionId: 'enemy_hp_below_30' },
        { actionId: 'rear_naked_choke', conditionId: 'distance_lt_2' },
        { actionId: 'lion_roar', conditionId: 'distance_gt_3' },
        { actionId: 'blood_droplet', triggerId: 'on_opponent_move_away' }, // AI 出招顺序
        { actionId: 'shadow_kick', triggerId: 'on_dodged' },
    ],
    taunt: () => '对不起……我没得选。',
}

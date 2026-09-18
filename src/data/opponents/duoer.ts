import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const DUOER_ATTRS = { strength: 4, vitality: 20, agility: 18, dexterity: 12, insight: 10, wisdom: 8 }

export const DUOER: OpponentDef = {
    id: 'duoer',
    name: '陶朵',
    story: '镇上的姑娘，小时候走失过几年。没人知道她去了哪里。后来她回了镇上，住下来，跟人说话总带着笑。',
    weapon: 'dagger',
    battleStyle: 'clinch',
    targetAttrs: DUOER_ATTRS,
    rewards: [
        action('sweep_kick'),
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
        { actionId: 'poison_detonate', condition: { type: 'enemy_hp_below', ratio: 0.3 } },
        { actionId: 'rear_naked_choke', condition: { type: 'distance_less_than', meters: 2 } },
        { actionId: 'lion_roar', condition: { type: 'distance_greater_than', meters: 3 } },
        { actionId: 'blood_droplet', triggerId: 'on_opponent_move_away' }, // AI 出招顺序
        { actionId: 'sweep_kick', triggerId: 'on_dodged' },
    ],
    taunt: () => '对不起……我没得选。',
}

import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../util/reward-utils'

const ATTRS = { strength: 10, vitality: 20, agility: 10, dexterity: 16, insight: 14, wisdom: 4 }

export const SANGYUAN: OpponentDef = {
    id: 'sangyuan',
    name: '红眼·桑原',
    story: '归海楼的空手道高手，以血祭之术闻名。越是濒临绝境，越是狂暴难挡。',
    weapon: 'bare_hands',
    targetAttrs: ATTRS,
    rewards: [
        action('hand_blade'),
        action('blood_qi_protection'),
        passive('blood_rage'),
        action('blood_droplet'),
        passive('sword_capture'),
        action('big_leap'),
        action('side_kick'),
        action('spinning_kick'),
        artifact('blood_sacrifice_armband'),
        artifact('headband'),
        // 10
    ],
    actionConfigs: [{ actionId: 'blood_droplet', conditionId: 'hp_above_70', triggerId: 'on_opponent_move_away' }],
    taunt: () => '血流得越多，我越兴奋。',
}

import { type OpponentDef } from '.'
import { action, artifact, passive } from '../../engine/util/reward-utils'

const ATTRS = { strength: 14, vitality: 20, agility: 12, dexterity: 12, insight: 14, wisdom: 4 }

export const SANGYUAN: OpponentDef = {
    id: 'sangyuan',
    name: '红眼·桑原',
    story: '归海楼的空手道高手，以血祭之术闻名。越是濒临绝境，越是狂暴难挡。',
    weapon: 'bare_hands',
    targetAttrs: ATTRS,
    battleStyle: 'melee',
    rewards: [
        passive('karate'),
        action('blood_qi_protection'),
        passive('blood_rage'),
        artifact('blood_sacrifice_armband'),
        action('blood_droplet'),
        passive('sword_capture'),
        action('side_kick'),
        action('big_leap'),
        action('spinning_kick'),
        passive('gear_shift'),
        artifact('chan_orb'),
        // 11
    ],
    actionConfigs: [
        { actionId: 'blood_droplet', conditionId: 'hp_above_70' },
        {
            actionId: 'hand_blade',
            triggerId: 'on_dodged',
        },
    ],
    taunt: () => '血流得越多，我越兴奋。',
}

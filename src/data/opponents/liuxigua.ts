import { type OpponentDef } from '.'
import { action, artifact, passive, weapon } from '../../engine/util/reward-utils'

const LIUXIGUA_ATTRS = { strength: 14, vitality: 10, agility: 20, dexterity: 14, insight: 14, wisdom: 4 }

export const LIUXIGUA: OpponentDef = {
    id: 'liuxigua',
    name: '霸刀·西瓜',
    weapon: 'qingfeng_jian',
    battleStyle: 'melee',
    targetAttrs: LIUXIGUA_ATTRS,
    rewards: [
        action('spinning_slash'),
        passive('momentum_mastery'),
        passive('overlord_art'),
        weapon('overlord_blade'),
        action('shadow_fist'),
        action('cyclone_slash'),
        action('sky_burner'),
        passive('weapon_stance'),
        passive('stance_time'),
        artifact('calming_talisman'),
        // 10
    ],
    actionConfigs: [
        {
            actionId: 'shadow_fist',
            triggerId: 'on_disarmed',
        },
    ],
}

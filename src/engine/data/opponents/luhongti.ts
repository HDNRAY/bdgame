import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action, artifact } from '.'

const LUHONGTI_ATTRS = { strength: 10, vitality: 9, agility: 10, dexterity: 9, insight: 16, wisdom: 20 }

export const LUHONGTI: OpponentDef = {
    id: 'luhongti',
    name: '铁剑·红提',
    targetAttrs: LUHONGTI_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'luhongti',
            '铁剑·红提',
            'strong',
            'heshan_sword',
            LUHONGTI_ATTRS,
            [
                passive('inner_power'),
                artifact('other_mountain'),
                passive('tai_chi_mastery'),
                passive('yue_nv_sword'),
                action('push_palm'),
                action('sword_thrust'),
                action('crushing_blow'),
            ],
            [
                { condition: { type: 'on_dodge' }, actionId: 'wrist_strike' },
                { condition: { type: 'on_dodged' }, actionId: 'light_slash' },
                { condition: { type: 'on_opponent_move' }, actionId: 'qi_bolt' },
                { condition: { type: 'on_debuff' }, actionId: 'break_formation' },
            ],
            n,
        ),
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action, artifact } from '.'

export const LUHONGTI: OpponentDef = {
    id: 'luhongti',
    name: '铁剑·红提',
    generate: (n) =>
        simpleGenerate(
            'luhongti',
            '铁剑·红提',
            'strong',
            'heshan_sword',
            { strength: 9, vitality: 8, agility: 9, dexterity: 9, insight: 16, wisdom: 20 },
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
                { condition: { type: 'on_dodged' }, actionId: 'slash' },
                { condition: { type: 'on_opponent_move' }, actionId: 'qi_bolt' },
                { condition: { type: 'on_debuff' }, actionId: 'break_formation' },
            ],
            n,
        ),
    aiOverrides: {},
}

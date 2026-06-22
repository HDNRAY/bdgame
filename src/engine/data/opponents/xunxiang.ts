import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action } from '.'

const XUNXIANG_ATTRS = { strength: 4, vitality: 6, agility: 16, dexterity: 14, insight: 14, wisdom: 20 }

export const XUNXIANG: OpponentDef = {
    id: 'xunxiang',
    name: '小凤·寻香',
    targetAttrs: XUNXIANG_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'xunxiang',
            '小凤·寻香',
            'swift',
            'bare_hands',
            XUNXIANG_ATTRS,
            [
                passive('lingxi_finger'),
                passive('yedi_lightness'),
                action('straight_punch'),
                // action('jab'),
                // action('flick'),
                action('wrist_strike'),
                action('push_palm'),
                action('push_hand'),
                action('throwing_knife'),
                action('deadly_knife'),
                action('steal_artifact'),
                action('yan_hui'),
                action('yan_fan'),
            ],
            [
                { condition: { type: 'on_parry' }, actionId: 'push_hand' },
                { condition: { type: 'on_dodged' }, actionId: 'throwing_knife' },
                { condition: { type: 'on_parried' }, actionId: 'throwing_knife' },
                { condition: { type: 'on_dodge' }, actionId: 'steal_artifact' },
            ],
            n,
        ),
    aiOverrides: {
        forceStyle: 'ranged',
    },
}

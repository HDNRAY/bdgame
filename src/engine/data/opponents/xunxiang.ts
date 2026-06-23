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
                action('wrist_strike'),
                action('throwing_knife'),
                action('push_palm'),
                action('push_hand'),
                action('deadly_knife'),
                action('steal_artifact'),
            ],
            n,
            [
                { actionId: 'straight_punch' },
                { actionId: 'wrist_strike' },
                { actionId: 'push_palm' },
                { actionId: 'push_hand', triggerId: 'on_parry' },
                { actionId: 'throwing_knife', triggerId: 'on_dodged' },
                { actionId: 'deadly_knife' },
                { actionId: 'steal_artifact', triggerId: 'on_dodge' },
                { actionId: 'yan_hui' },
                { actionId: 'yan_fan' },
            ],
        ),
    aiOverrides: {
        forceStyle: 'ranged',
    },
}

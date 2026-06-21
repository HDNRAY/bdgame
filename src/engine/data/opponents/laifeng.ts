import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

const LAIFENG_ATTRS = { strength: 14, vitality: 8, agility: 20, dexterity: 12, insight: 10, wisdom: 12 }

export const LAIFENG: OpponentDef = {
    id: 'laifeng',
    name: '空拳·来风',
    targetAttrs: LAIFENG_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'laifeng',
            '空拳·来风',
            'balanced',
            'bare_hands',
            LAIFENG_ATTRS,
            [
                passive('forge'),
                artifact('qi_amplifier'),
                action('qi_focus'),
                action('qi_gather'),
                action('straight_punch'),
                action('iron_charge'),
                action('qi_bolt'),
                action('eighteen_palms'),
            ],
            [
                {
                    condition: { type: 'on_opponent_move' },
                    actionId: 'qi_bolt',
                },
                {
                    condition: { type: 'on_dodge' },
                    actionId: 'qinlong_gong',
                },
            ],
            n,
        ),
}

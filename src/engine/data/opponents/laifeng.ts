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
            n,
            undefined,
            [
                { actionId: 'qi_focus' },
                { actionId: 'qi_gather' },
                { actionId: 'straight_punch' },
                { actionId: 'iron_charge' },
                { actionId: 'eighteen_palms' },
                { actionId: 'qi_bolt', triggerId: 'on_opponent_move' },
                { actionId: 'qinlong_gong', triggerId: 'on_dodge' },
            ],
        ),
}

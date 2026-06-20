import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

export const LAIFENG: OpponentDef = {
    id: 'laifeng',
    name: '空拳·来风',
    generate: (n) =>
        simpleGenerate(
            'laifeng',
            '空拳·来风',
            'balanced',
            'bare_hands',
            { strength: 14, vitality: 8, agility: 20, dexterity: 12, insight: 10, wisdom: 12 },
            [
                passive('forge'),
                artifact('qi_amplifier'),
                action('qi_focus'),
                action('qi_gather'),
                action('straight_punch'),
                action('iron_charge'),
                action('qi_bolt'),
            ],
            [
                {
                    condition: { type: 'on_opponent_move' },
                    actionId: 'qi_bolt',
                },
            ],
            n,
        ),
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action } from '.'

export const LAIFENG: OpponentDef = {
    id: 'laifeng',
    name: '空拳·来风',
    generate: (n) =>
        simpleGenerate(
            'laifeng',
            '空拳·来风',
            'balanced',
            'bare_hands',
            { strength: 14, vitality: 8, agility: 20, dexterity: 12, insight: 12, wisdom: 12 },
            [
                passive('forge'),
                action('qi_focus'),
                action('qi_gather'),
                action('straight_punch'),
                action('flick'),
                action('iron_charge'),
                action('qi_bolt'),
            ],
            [
                {
                    condition: { type: 'on_opponent_move', check: (ctx) => (ctx.moveDelta ?? 0) > 0 },
                    actionId: 'qi_bolt',
                },
                { condition: { type: 'on_pre_action' }, actionId: 'flick' },
            ],
            n,
        ),
}

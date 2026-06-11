import { type OpponentDef, simpleGenerate, passive, action } from './base'

export const PLAYER: OpponentDef = {
    id: 'p1',
    name: '空拳·玩家',
    generate: (n) =>
        simpleGenerate(
            'p1',
            '空拳·玩家',
            'balanced',
            'bare_hands',
            { strength: 14, vitality: 8, agility: 20, dexterity: 12, insight: 12, wisdom: 12 },
            [
                passive('forge'),
                passive('ling_bo_wei_bu'),
                action('qi_focus'),
                action('qi_gather'),
                action('straight_punch'),
                // action('crushing_blow'),
                action('iron_charge'),
            ],
            [
                // { condition: { type: 'on_parry' }, actionId: 'straight_punch' },
                // { condition: { type: 'on_dodged' }, actionId: 'flick' },
                { condition: { type: 'on_move' }, actionId: 'qi_bolt' },
            ],
            n,
        ),
}

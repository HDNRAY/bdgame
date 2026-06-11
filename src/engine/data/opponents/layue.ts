import { type OpponentDef, simpleGenerate, passive, action } from './base'

export const LAYUE: OpponentDef = {
    id: 'l1',
    name: '腊月',
    generate: (n) =>
        simpleGenerate(
            'l1',
            '腊月',
            'swift',
            'twin_swords',
            { strength: 7, vitality: 7, agility: 20, dexterity: 18, insight: 16, wisdom: 4 },
            [
                passive('sword_dominion'),
                passive('nine_deaths'),
                action('nine_deaths_strike'),
                // action('flick'),
                // action('straight_punch'),
                // action('qi_bolt'),
            ],
            [
                // { condition: { type: 'on_dodged' }, actionId: 'flick' },
                // { condition: { type: 'on_parry' }, actionId: 'straight_punch' },
                // { condition: { type: 'on_move' }, actionId: 'qi_bolt' },
            ],
            n,
        ),
}

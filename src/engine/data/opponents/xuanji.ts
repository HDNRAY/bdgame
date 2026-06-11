import { OpponentDef, simpleGenerate, passive, action } from './base'

export const XUANJI: OpponentDef = {
    id: 'm1',
    name: '御物·玄机',
    generate: (n) =>
        simpleGenerate(
            'm1',
            '御物·玄机',
            'wise',
            'tri_orb',
            { strength: 6, vitality: 10, agility: 10, dexterity: 14, insight: 14, wisdom: 18 },
            [passive('spirit_resonance'), action('qi_bolt')],
            [
                { condition: { type: 'on_parry' }, actionId: 'restore_ap' },
                { condition: { type: 'on_dodge' }, actionId: 'summon_haste' },
                { condition: { type: 'on_hit' }, actionId: 'agility_steal' },
            ],
            n,
            ['wisdom', 'dexterity', 'insight', 'vitality', 'agility', 'strength'],
        ),
}

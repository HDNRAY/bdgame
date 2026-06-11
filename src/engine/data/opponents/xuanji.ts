import { type OpponentDef, simpleGenerate, passive, action, implant } from './base'

export const XUANJI: OpponentDef = {
    id: 'm1',
    name: '御物·玄机',
    generate: (n) =>
        simpleGenerate(
            'm1',
            '御物·玄机',
            'wise',
            'tri_orb',
            { strength: 6, vitality: 10, agility: 12, dexterity: 15, insight: 15, wisdom: 19 },
            [
                passive('spirit_resonance'),
                action('qi_bolt'),
                implant('qi_guard'),
                implant('iron_will'),
                implant('ap_boost'),
            ],
            [
                { condition: { type: 'on_parry' }, actionId: 'restore_ap' },
                { condition: { type: 'on_dodge' }, actionId: 'summon_haste' },
                { condition: { type: 'on_hit' }, actionId: 'agility_steal' },
            ],
            n,
        ),
}

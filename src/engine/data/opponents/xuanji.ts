import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action, artifact } from '.'

export const XUANJI: OpponentDef = {
    id: 'xuanji',
    name: '御物·玄机',
    generate: (n) =>
        simpleGenerate(
            'xuanji',
            '御物·玄机',
            'wise',
            'tri_orb',
            { strength: 6, vitality: 10, agility: 12, dexterity: 15, insight: 15, wisdom: 19 },
            [
                passive('spirit_resonance'),
                action('qi_bolt'),
                artifact('qi_guard'),
                artifact('iron_will'),
                artifact('ap_boost'),
            ],
            [
                { condition: { type: 'on_parry' }, actionId: 'restore_ap' },
                { condition: { type: 'on_dodge' }, actionId: 'summon_haste' },
                { condition: { type: 'on_hit' }, actionId: 'agility_steal' },
            ],
            n,
        ),
    aiOverrides: {},
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action, artifact } from '.'

const XUANJI_ATTRS = { strength: 6, vitality: 10, agility: 12, dexterity: 15, insight: 15, wisdom: 18 }

export const XUANJI: OpponentDef = {
    id: 'xuanji',
    name: '御物·玄机',
    targetAttrs: XUANJI_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'xuanji',
            '御物·玄机',
            'wise',
            'tri_orb',
            XUANJI_ATTRS,
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

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
                action('qi_bolt'),
                passive('spirit_resonance'),
                artifact('qi_guard'),
                artifact('iron_will'),
                artifact('ap_boost'),
            ],
            n,
            [
                { actionId: 'qi_bolt' },
                { actionId: 'restore_ap', triggerId: 'on_parry' },
                { actionId: 'summon_haste', triggerId: 'on_dodge' },
                { actionId: 'agility_steal', triggerId: 'on_hit' },
            ],
        ),
    aiOverrides: {},
}

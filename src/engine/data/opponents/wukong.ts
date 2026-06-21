import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

export const WUKONG: OpponentDef = {
    id: 'wukong',
    name: '天命·悟空',
    aiOverrides: { forceStyle: 'melee' },
    generate: (n) =>
        simpleGenerate(
            'wukong',
            '天命·悟空',
            'balanced',
            'dinghai_shen_tie',
            { strength: 20, vitality: 10, agility: 13, dexterity: 16, insight: 10, wisdom: 5 },
            [
                passive('stone_skin'),
                passive('hua_gun'),
                passive('qishier_bian'),
                artifact('fiery_eyes'),
                action('rod_thrust'),
                action('rod_cleave'),
                action('rod_sweep'),
                action('santou_liubi'),
                action('jindou'),
                // action('straight_punch'),
                // action('jab'),
                // action('kick'),
            ],
            [
                {
                    condition: { type: 'on_parried' },
                    actionId: 'rod_sweep',
                },
            ],
            n,
        ),
}

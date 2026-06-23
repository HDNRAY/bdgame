import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

const WUKONG_ATTRS = { strength: 20, vitality: 10, agility: 13, dexterity: 16, insight: 10, wisdom: 5 }

export const WUKONG: OpponentDef = {
    id: 'wukong',
    name: '天命·悟空',
    targetAttrs: WUKONG_ATTRS,
    aiOverrides: { forceStyle: 'melee' },
    generate: (n) =>
        simpleGenerate(
            'wukong',
            '天命·悟空',
            'balanced',
            'dinghai_shen_tie',
            WUKONG_ATTRS,
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
            n,
            undefined,
            undefined,
            [
                { actionId: 'rod_thrust' },
                { actionId: 'rod_cleave' },
                { actionId: 'rod_sweep' },
                { actionId: 'santou_liubi' },
                { actionId: 'jindou' },
                { actionId: 'rod_sweep', triggerId: 'on_parried' },
            ],
        ),
}

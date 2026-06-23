import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

const AJIU_ATTRS = { strength: 12, vitality: 10, agility: 19, dexterity: 16, insight: 14, wisdom: 4 }

export const AJIU: OpponentDef = {
    id: 'ajiu',
    name: '断刀·阿九',
    story: '青山镇孤儿院里出来的孩子。没人知道TA的父母是谁，只知道TA那把断刀从不离手。沉默，寡言，但比谁都可靠。',
    taunt: '……让开。',
    targetAttrs: AJIU_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'ajiu',
            '断刀·阿九',
            'balanced',
            'broken_blade',
            AJIU_ATTRS,
            [
                passive('dimensional_blade_mastery'),
                passive('shenxing_baibian'),
                passive('xuannv_sword'),
                artifact('titanium_arm'),
                artifact('muscle_boost'),
                action('spirit_sword'),
                action('light_slash'),
                action('heavy_slash'),
                action('blaze_strike'),
                action('guard'),
            ],
            n,
            undefined,
            [
                { actionId: 'spirit_sword' },
                { actionId: 'light_slash' },
                { actionId: 'heavy_slash' },
                { actionId: 'blaze_strike' },
                { actionId: 'guard' },
                { actionId: '_arm_explosion', triggerId: 'hp_below_50' },
            ],
        ),
}

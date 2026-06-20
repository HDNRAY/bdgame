import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

export const AJIU: OpponentDef = {
    id: 'ajiu',
    name: '断刀·阿九',
    generate: (n) =>
        simpleGenerate(
            'ajiu',
            '断刀·阿九',
            'balanced',
            'broken_blade',
            { strength: 10, vitality: 9, agility: 19, dexterity: 16, insight: 14, wisdom: 4 },
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
            [
                {
                    condition: {
                        type: 'hp_below',
                        check: (ctx) => ctx.actor.hp / ctx.actor.maxHp < 0.5,
                    },
                    actionId: '_arm_explosion',
                },
            ],
            n,
        ),
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action, artifact } from '.'

const YANGGUO_ATTRS = { strength: 10, vitality: 10, agility: 14, dexterity: 14, insight: 20, wisdom: 8 }

export const YANGGUO: OpponentDef = {
    id: 'yangguo',
    name: '西狂·过儿',
    targetAttrs: YANGGUO_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'yangguo',
            '西狂·过儿',
            'balanced',
            'dark_iron_sword',
            YANGGUO_ATTRS,
            [
                passive('one_arm'),
                passive('dark_room_catch'),
                passive('dark_iron_sword_art'),
                passive('tide_inner_power'),
                artifact('snake_gall'),
                action('desolate_palm'),
                action('quanzhen_sword'),
                action('yunv_sword'),
            ],
            n,
            undefined,
            [
                { actionId: 'desolate_palm' },
                { actionId: 'quanzhen_sword' },
                { actionId: 'yunv_sword' },
                { actionId: 'flick', triggerId: 'on_dodge' },
                { actionId: 'yunv_sword', triggerId: 'on_parry' },
            ],
        ),
    aiOverrides: {},
}

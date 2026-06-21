import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

export const LONGNV: OpponentDef = {
    id: 'longnv',
    name: '龙女·语嫣',
    generate: (n) =>
        simpleGenerate(
            'longnv',
            '龙女·语嫣',
            'swift',
            'dual_swords',
            { strength: 15, vitality: 10, agility: 13, dexterity: 18, insight: 14, wisdom: 4 },
            [
                passive('dark_room_catch'),
                artifact('golden_silk_gloves'),
                artifact('herb_pouch'),
                action('quanzhen_sword'),
                action('yunv_sword'),
                action('yufeng_needle'),
                passive('yuxin_sword_mastery'),
            ],
            [],
            n,
        ),
    aiOverrides: {},
}

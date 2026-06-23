import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

const LONGNV_ATTRS = { strength: 16, vitality: 10, agility: 14, dexterity: 18, insight: 14, wisdom: 4 }

export const LONGNV: OpponentDef = {
    id: 'longnv',
    name: '龙女·语嫣',
    targetAttrs: LONGNV_ATTRS,
    generate: (n) =>
        simpleGenerate(
            'longnv',
            '龙女·语嫣',
            'swift',
            'dual_swords',
            LONGNV_ATTRS,
            [
                passive('dark_room_catch'),
                artifact('golden_silk_gloves'),
                action('yunv_sword'),
                artifact('herb_pouch'),
                action('quanzhen_sword'),
                action('yufeng_needle'),
                passive('yuxin_sword_mastery'),
            ],
            n,
        ),
    aiOverrides: {},
}

import type { StoryDef } from '../../game/entities/story'

export const VETERAN: StoryDef = {
    id: 'veteran',
    name: '军旅退伍',
    characterName: '退役军人',
    description: '世代从军。你从小在军营边长大，看惯了操练和号角。',
    overrides: {
        2: 'veteran_n02_intro',
        3: 'veteran_n03_intro',
        4: 'veteran_start_training',
        5: 'veteran_n05_formal',
        6: 'veteran_n06_enlist',
        8: 'veteran_n08_path_choice',
    },
    insertions: [
        { eventId: 'tiangong_weapon', range: [23, 23] },
        { eventId: 'douqi_library', range: [24, 24] },
    ],
    reward: { type: 'points', id: '' },
}

import type { StoryDef } from '../../game/entities/story'

export const VETERAN: StoryDef = {
    id: 'veteran',
    name: '军旅退伍',
    characterName: '陆斐',
    description: '父亲是军人，战死了。你从小在军队孤儿院长大，看惯了操练与号角。没有家族，没有牵挂。',
    overrides: {
        1: 'origin_veteran',
        2: 'veteran_n02_weapon',
        3: 'veteran_n03_intro',
        4: 'veteran_start_training',
        5: 'veteran_n05_formal',
        6: 'veteran_n06_enlist',
        8: 'veteran_n08_path_choice',
    },
    insertions: [
        { eventId: 'tiangong_weapon', range: [23, 23] },
        { eventId: 'douqi_library', range: [24, 24] },
        { eventId: 'memory_within_memory', range: [4, 8] },
    ],
    reward: { type: 'points', id: '' },
}

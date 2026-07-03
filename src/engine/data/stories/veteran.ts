import type { StoryDef } from '../../entities/story'

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
    },
    insertions: [],
}

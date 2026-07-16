import type { StoryDef } from '../../entities/story'

export const SECT: StoryDef = {
    id: 'sect',
    name: '天生道种',
    characterName: '天骄',
    description:
        '自幼与师兄被选入山门修行。你们都是百年一遇的天生道种，虽然年纪有差，但一起入门，是最亲的师兄弟。你们的修炼由同是天生道种的腊月安排。',
    overrides: {
        2: 'sect_n02_weapon',
        3: 'sect_n03_action',
        11: 'sect_n11_tragedy',
        16: 'sect_n16_reunion',
        19: 'sect_n19_trail',
        22: 'sect_n22_tournament',
    },
    insertions: [{ eventId: 'tiangong_weapon', range: [23, 23] }],
    reward: { type: 'artifact', id: 'innate_seed' },
    onNode: (state, idx) => {
        if (idx === 2 || (idx >= 5 && idx % 4 === 1)) {
            state.unspentPoints += 1
        }
    },
}

import type { StoryDef } from '../../game/entities/story'

export const SECT: StoryDef = {
    id: 'sect',
    name: '天生道种',
    characterName: '苏念',
    description:
        '自幼与师兄被选入**玄青宗**山门修行。你们都是百年一遇的天生道种，虽然年纪有差，但一起入门，是最亲的师兄弟。你们的修炼由同是天生道种的腊月安排。',
    overrides: {
        2: 'sect_n02_weapon',
        3: 'sect_n03_action',
        11: 'sect_n11_tragedy',
        16: 'sect_n16_reunion',
        19: 'sect_n19_trail',
        24: 'douqi_library',
        25: 'tiangong_weapon',
    },
    insertions: [],
    reward: { type: 'artifact', id: 'innate_seed' },
    onNode: (state, idx) => {
        // 天生道种：每 3 节点 +1 修炼点（2,5,8,11,14,17,20,23 = 8 点）
        if (idx >= 2 && idx % 3 === 2 && idx <= 23) {
            state.unspentPoints += 1
        }
    },
}

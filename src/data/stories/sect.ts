import type { StoryDef } from '../../game/entities/story'

export const SECT: StoryDef = {
    id: 'sect',
    name: '天生道种',
    characterName: '苏念',
    description:
        '百年一遇的根骨，自幼与师兄一同入玄青宗山门修行。你们年纪有差，但一起入门，是最亲的师兄弟。你们的修炼由同是天生道种的腊月安排。',
    overrides: {
        1: 'origin_sect',
        2: 'sect_n02_weapon',
        3: 'sect_n03_action',
        11: 'sect_n11_tragedy',
        16: 'sect_n16_reunion',
        19: 'sect_n19_trail',
        24: 'douqi_library',
        25: 'tiangong_weapon',
    },
    insertions: [{ eventId: 'memory_within_memory', range: [4, 8] }],
    reward: { type: 'artifact', id: 'innate_seed' },
    onNode: (state, idx) => {
        // 天生道种（奇物）的效果：每 3 节点 +1 修炼点（2,5,8,11,14,17,20,23 = 8 点），不计入 16 次修炼点预算
        if (idx >= 2 && idx % 3 === 2 && idx <= 23) {
            state.unspentPoints += 1
        }
    },
}

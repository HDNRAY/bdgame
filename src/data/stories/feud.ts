import type { StoryDef } from '../../game/entities/story'

export const FEUD: StoryDef = {
    id: 'feud',
    name: '血海深仇',
    characterName: '林晚风',
    description:
        '林家世代反对义体研究。某个深夜，一场大火吞没了祖宅——只有你活了下来。会长姬仲（你父亲挚友）从废墟里把你抱出来，你从此在青山镇长大。你只知道那场火是义体研究部的手笔。',
    overrides: {
        1: 'origin_feud',
        2: 'feud_n02_weapon',
        3: 'feud_n03_action',
        22: 'boss_ajiu',
    },
    insertions: [
        { eventId: 'tiangong_weapon', range: [23, 23] },
        { eventId: 'feud_hongti_spar', range: [12, 21] },
        { eventId: 'douqi_library', range: [24, 24] },
        { eventId: 'memory_within_memory', range: [4, 8] },
    ],
    reward: { type: 'points', id: '' },
}

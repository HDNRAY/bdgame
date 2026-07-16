import type { StoryDef } from '../../engine/entities/story'

export const FEUD: StoryDef = {
    id: 'feud',
    name: '血海深仇',
    characterName: '林晚风',
    description:
        '你的家族世代反对义体研究。某个深夜，一场大火吞没了祖宅——"意外"中只有你活了下来。会长（你父亲挚友）赶到时从废墟里把你抱出来。你从此在青山镇长大，不知道那场火是义体研究部的手笔。',
    overrides: {
        2: 'feud_n02_weapon',
        3: 'feud_n03_action',
        22: 'boss_ajiu',
    },
    insertions: [
        { eventId: 'tiangong_weapon', range: [23, 23] },
        { eventId: 'feud_luhongti_spar', range: [12, 21] },
    ],
    reward: { type: 'points', id: '' },
}

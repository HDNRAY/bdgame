import type { StoryDef } from '../../engine/entities/story'

export const WANDERER: StoryDef = {
    id: 'wanderer',
    name: '奇遇流',
    characterName: '浪迹者',
    description:
        '小时候有个很好的玩伴——**朵儿**，是个孤儿。后来听说她被招入了**学校修习，就没再见过。七岁那年你在后山玩耍，偶遇一对隐世夫妇——过儿与龙女。你后来才知道，他们就是六绝中的「观」与「逸」，名列青山之巅。他们见你筋骨不错，便赠你兵器、教你功法。',
    overrides: {
        2: 'wanderer_n02_intro',
        3: 'wanderer_n03_intro',
    },
    insertions: [{ eventId: 'tiangong_weapon', range: [23, 23] }],
    reward: { type: 'points', id: '' },
}

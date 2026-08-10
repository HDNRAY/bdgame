import type { StoryDef } from '../../game/entities/story'

export const WANDERER: StoryDef = {
    id: 'wanderer',
    name: '奇遇流',
    characterName: '叶寻',
    description:
        '小时候有个很好的玩伴——**陶朵**，是个孤儿。后来听说她被招入了**学校修习，就没再见过。七岁那年你在青山边缘的林地玩耍，误入深山遇险，被一对隐世夫妇所救——杨之改与龙语仙。你后来才知道，他们就是六绝中的「观」与「逸」，名列青山之巅。他们见你筋骨不错，便赠你兵器、教你功法。',
    overrides: {
        2: 'wanderer_n02_intro',
        3: 'wanderer_n03_intro',
    },
    insertions: [
        { eventId: 'tiangong_weapon', range: [23, 23] },
        { eventId: 'douqi_library', range: [24, 24] },
    ],
    reward: { type: 'points', id: '' },
}

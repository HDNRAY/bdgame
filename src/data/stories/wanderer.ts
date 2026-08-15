import type { StoryDef } from '../../game/entities/story'

export const WANDERER: StoryDef = {
    id: 'wanderer',
    name: '奇遇流',
    characterName: '叶寻',
    description:
        '你和陶朵、奇岚都是孤儿，一起在镇子的巷子里长大。后来陶朵失踪了，奇岚进了协会，你一个人在山野间行走修炼。七岁那年你们曾在青山边缘遇险，被一对隐世夫妇所救——他们就是六绝中的「观」与「逸」。',
    overrides: {
        1: 'origin_wanderer',
        2: 'wanderer_n02_intro',
        3: 'wanderer_n03_intro',
    },
    insertions: [
        { eventId: 'tiangong_weapon', range: [23, 23] },
        { eventId: 'douqi_library', range: [24, 24] },
        { eventId: 'memory_within_memory', range: [4, 8] },
    ],
    reward: { type: 'points', id: '' },
}

import type { StoryDef } from '../../game/entities/story'
import { storyRewardEffects } from '../events/layout'

export const WANDERER: StoryDef = {
    id: 'wanderer',
    name: '朝花夕拾',
    characterName: '叶寻',
    description:
        '你和陶朵、奇岚都是孤儿，一起在镇子的巷子里长大。后来陶朵失踪了，奇岚进了协会，你一个人在山野间行走修炼。七岁那年你们曾在青山边缘遇险，被一对隐世夫妇所救——他们就是六绝中的「观」与「逸」。',
    originEventId: 'origin_wanderer',
    reward: storyRewardEffects('wanderer', 'duoer', [{ kind: 'points', n: 4, count: true }]),
}

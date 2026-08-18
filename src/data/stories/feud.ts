import type { StoryDef } from '../../game/entities/story'
import { storyRewardEffects } from '../events/layout'

export const FEUD: StoryDef = {
    id: 'feud',
    name: '断刀',
    characterName: '林晚风',
    description:
        '林家世代反对义体研究。某个深夜，一场大火吞没了祖宅——只有你活了下来。会长姬仲（你父亲挚友）从废墟里把你抱出来，你从此在青山镇长大。你只知道那场火是义体研究部的手笔。',
    originEventId: 'origin_feud',
    reward: storyRewardEffects('feud', 'junshi', [{ kind: 'points', n: 4, count: true }]),
}

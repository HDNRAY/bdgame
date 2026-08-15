import type { StoryDef } from '../../game/entities/story'
import { storyRewardEffects } from '../events/layout'

export const SECT: StoryDef = {
    id: 'sect',
    name: '天生道种',
    characterName: '苏念',
    description:
        '百年一遇的根骨，自幼与师兄一同入玄青宗山门修行。你们年纪有差，但一起入门，是最亲的师兄弟。你们的修炼由同是天生道种的腊月安排。',
    originEventId: 'origin_sect',
    reward: storyRewardEffects('sect', 'junshi', [
        { kind: 'grant', type: 'artifact', id: 'innate_seed' },
        // 天生道种（奇物）的效果：额外 8 点修炼，不计入 16 次预算
        { kind: 'points', n: 8 },
    ]),
}

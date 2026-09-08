import type { StoryDef } from '../../game/entities/story'
import { storyRewardEffects } from '../events/layout'

export const XUANMEN: StoryDef = {
    id: 'xuanmen',
    name: '双生祭',
    characterName: '玄十',
    description:
        '玄门，青山镇最古老的宗门之一，血脉中拥有以炁御物的能力。你有一个双胞胎姐姐——家里有件事，大人们从不提起。',
    originEventId: 'origin_xuanmen',
    reward: storyRewardEffects('xuanmen', 'xuanji', [{ kind: 'points', n: 4, count: true }]),
}

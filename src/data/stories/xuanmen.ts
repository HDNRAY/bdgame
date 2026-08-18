import type { StoryDef } from '../../game/entities/story'
import { storyRewardEffects } from '../events/layout'

export const XUANMEN: StoryDef = {
    id: 'xuanmen',
    name: '双生祭',
    characterName: '玄十 → 玄久',
    description:
        '玄门，青山镇最古老的宗门之一，血脉中拥有以炁御物的能力。你有一个双胞胎姐姐，而玄门有一条历代传下的规矩——双胞胎，只能留一个。',
    originEventId: 'origin_xuanmen',
    reward: storyRewardEffects('xuanmen', 'xuanji', [{ kind: 'points', n: 4, count: true }]),
}

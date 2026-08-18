import type { StoryDef } from '../../game/entities/story'
import { storyRewardEffects } from '../events/layout'

export const VETERAN: StoryDef = {
    id: 'veteran',
    name: '夜行者',
    characterName: '陆斐',
    description: '父亲是军人，战死了。你从小在军队孤儿院长大，看惯了操练与号角。没有家族，没有牵挂。',
    originEventId: 'origin_veteran',
    reward: storyRewardEffects('veteran', 'fanglie', [{ kind: 'points', n: 4, count: true }]),
}

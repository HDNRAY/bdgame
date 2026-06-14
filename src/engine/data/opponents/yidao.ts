import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact } from '.'
import type { Reward } from '../rewards'
import type { TriggerSlot } from '../../entities/trigger'

const POOL = ['iaijutsu_strike', 'slash', 'human_radar', 'resheath', 'empty_hand', 'tiger_eye']

function rewardType(id: string): 'passive' | 'artifact' | 'action' {
    if (id === 'iaijutsu_mastery' || id === 'empty_hand' || id === 'human_radar') return 'passive'
    if (id === 'tiger_eye') return 'artifact'
    return 'action'
}

export const YIDAO: OpponentDef = {
    id: 'yidao',
    name: '居合·一刀',
    generate: (n) => {
        const rewards: Reward[] = [
            passive('iaijutsu_mastery'),
            ...POOL.map((id) => ({ type: rewardType(id), id, name: id, description: '', tags: [] }) as Reward),
        ]

        // n=33 时 slash 必选，触发确定
        const triggers: TriggerSlot[] = [{ condition: { type: 'on_parry' }, actionId: 'slash' }]

        return simpleGenerate(
            'yidao',
            '居合·一刀',
            'swift',
            'zantetsu',
            { strength: 20, vitality: 11, agility: 14, dexterity: 13, insight: 13, wisdom: 7 },
            rewards,
            triggers,
            n,
        )
    },
}

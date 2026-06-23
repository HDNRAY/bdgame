import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive } from '.'
import type { Reward } from '../../entities/reward'
import type { ActionConfig } from '../../entities/action-config'

const YIDAO_ATTRS = { strength: 19, vitality: 11, agility: 14, dexterity: 14, insight: 13, wisdom: 6 }

const POOL = ['iaijutsu_strike', 'light_slash', 'human_radar', 'resheath', 'empty_hand', 'tiger_eye']

function rewardType(id: string): 'passive' | 'artifact' | 'action' {
    if (id === 'iaijutsu_mastery' || id === 'empty_hand' || id === 'human_radar') return 'passive'
    if (id === 'tiger_eye') return 'artifact'
    return 'action'
}

export const YIDAO: OpponentDef = {
    id: 'yidao',
    name: '居合·一刀',
    targetAttrs: YIDAO_ATTRS,
    generate: (n) => {
        const rewards: Reward[] = [
            passive('iaijutsu_mastery'),
            ...POOL.map((id) => ({ type: rewardType(id), id, name: id, description: '', tags: [] }) as Reward),
        ]

        const actionConfigs: ActionConfig[] = [
            { actionId: 'iaijutsu_strike' },
            { actionId: 'light_slash' },
            { actionId: 'resheath' },
        ]

        return simpleGenerate(
            'yidao',
            '居合·一刀',
            'swift',
            'zantetsu',
            YIDAO_ATTRS,
            rewards,
            n,
            undefined,
            0,
            actionConfigs,
        )
    },
}

import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef } from '.'
import type { Reward } from '../../entities/reward'
import type { ActionConfig } from '../../entities/action-config'

const YIDAO_ATTRS = { strength: 19, vitality: 11, agility: 14, dexterity: 14, insight: 13, wisdom: 6 }

export const YIDAO: OpponentDef = {
    id: 'yidao',
    name: '居合·一刀',
    targetAttrs: YIDAO_ATTRS,
    generate: (n) => {
        const rewards: Reward[] = [
            { type: 'action', id: 'light_slash', name: 'light_slash', description: '', tags: [] },
            { type: 'passive', id: 'iaijutsu_mastery', name: 'iaijutsu_mastery', description: '', tags: [] },
            { type: 'passive', id: 'human_radar', name: 'human_radar', description: '', tags: [] },
            { type: 'action', id: 'iaijutsu_strike', name: 'iaijutsu_strike', description: '', tags: [] },
            { type: 'action', id: 'resheath', name: 'resheath', description: '', tags: [] },
            { type: 'artifact', id: 'tiger_eye', name: 'tiger_eye', description: '', tags: [] },
        ]

        const actionConfigs: ActionConfig[] = [
            { actionId: 'iaijutsu_strike' },
            { actionId: 'light_slash' },
            { actionId: 'resheath' },
        ]

        return simpleGenerate('yidao', '居合·一刀', 'swift', 'zantetsu', YIDAO_ATTRS, rewards, n, actionConfigs)
    },
}

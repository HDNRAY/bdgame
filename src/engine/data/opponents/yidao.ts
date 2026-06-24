import { type OpponentDef } from '.'
import { weapon } from '../../systems/reward-pool'

const YIDAO_ATTRS = { strength: 19, vitality: 11, agility: 14, dexterity: 14, insight: 13, wisdom: 6 }

export const YIDAO: OpponentDef = {
    id: 'yidao',
    name: '居合·一刀',
    weapon: 'qingfeng_jian',
    targetAttrs: YIDAO_ATTRS,
    rewards: [
        { type: 'action', id: 'light_slash', name: 'light_slash', description: '', tags: [] },
        { type: 'passive', id: 'iaijutsu_mastery', name: 'iaijutsu_mastery', description: '', tags: [] },
        { type: 'passive', id: 'human_radar', name: 'human_radar', description: '', tags: [] },
        { type: 'action', id: 'iaijutsu_strike', name: 'iaijutsu_strike', description: '', tags: [] },
        { type: 'action', id: 'resheath', name: 'resheath', description: '', tags: [] },
        { type: 'artifact', id: 'tiger_eye', name: 'tiger_eye', description: '', tags: [] },
        weapon('zantetsu'),
    ],
    actionConfigs: [{ actionId: 'iaijutsu_strike' }, { actionId: 'light_slash' }, { actionId: 'resheath' }],
}

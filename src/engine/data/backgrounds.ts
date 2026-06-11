import type { AttrName } from '../entities/attributes'

/** 角色背景定义 */
export interface Background {
    id: string
    name: string
    desc: string
    /** 初始属性加成 */
    attrs: Partial<Record<AttrName, number>>
}

export const BACKGROUNDS: Background[] = [
    {
        id: 'balanced',
        name: '均衡',
        desc: '各项属性均衡发展',
        attrs: { strength: 5, vitality: 5, agility: 5, dexterity: 5, insight: 5, wisdom: 5 },
    },
    {
        id: 'strong',
        name: '力士',
        desc: '天生神力，皮糙肉厚',
        attrs: { strength: 7, vitality: 6, agility: 3, dexterity: 3, insight: 3, wisdom: 4 },
    },
    {
        id: 'swift',
        name: '刺客',
        desc: '身法矫健，出手如电',
        attrs: { strength: 3, vitality: 3, agility: 7, dexterity: 6, insight: 3, wisdom: 4 },
    },
]

/** 按 ID 查找背景 */
export function getBackground(id: string): Background | undefined {
    return BACKGROUNDS.find((b) => b.id === id)
}

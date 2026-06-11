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
        attrs: { strength: 3, vitality: 3, agility: 3, dexterity: 3, insight: 3, wisdom: 3 },
    },
    {
        id: 'strong',
        name: '力士',
        desc: '天生神力，皮糙肉厚',
        attrs: { strength: 4, vitality: 4, agility: 2, dexterity: 2, insight: 3, wisdom: 3 },
    },
    {
        id: 'swift',
        name: '刺客',
        desc: '身法矫健，出手如电',
        attrs: { strength: 2, vitality: 2, agility: 4, dexterity: 4, insight: 3, wisdom: 3 },
    },
    {
        id: 'wise',
        name: '玄门',
        desc: '悟性通玄，御物于心',
        attrs: { strength: 2, vitality: 3, agility: 2, dexterity: 3, insight: 4, wisdom: 4 },
    },
]

/** 按 ID 查找背景 */
export function getBackground(id: string): Background | undefined {
    return BACKGROUNDS.find((b) => b.id === id)
}

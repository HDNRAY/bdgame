/** 角色背景定义 */
export interface Background {
    id: string
    name: string
    desc: string
}

export const BACKGROUNDS: Background[] = [
    {
        id: 'balanced',
        name: '均衡',
        desc: '各项属性均衡发展',
    },
    {
        id: 'strong',
        name: '力士',
        desc: '天生神力，皮糙肉厚',
    },
    {
        id: 'swift',
        name: '刺客',
        desc: '身法矫健，出手如电',
    },
    {
        id: 'wise',
        name: '玄门',
        desc: '推演通玄，御物于心',
    },
]

/** 按 ID 查找背景 */
export function getBackground(id: string): Background | undefined {
    return BACKGROUNDS.find((b) => b.id === id)
}

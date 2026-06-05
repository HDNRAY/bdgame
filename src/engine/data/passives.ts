import type { Passive } from '../entities/passive'

/** 功法 / 天赋（绝学）注册表 */
export const PASSIVES: Passive[] = [
    {
        id: 'forge_4',
        name: '锻体·四级',
        description: '基础锻体，全属性+1。',
        effects: [{ type: 'stat_buff', attrs: { strength: 1, vitality: 1, agility: 1, dexterity: 1, insight: 1 } }],
    },
    {
        id: 'iron_bone',
        name: '钢筋铁骨',
        description: '铜皮铁骨。',
    },
    {
        id: 'lingbo_weibu',
        name: '凌波微步',
        description: '绝世轻功，身法达到一定境界后自然领悟。步法精妙，难以捉摸。',
        tags: ['first_strike'],
        requireAttrs: { agility: 18 },
        effects: [],
        triggers: [{ condition: { type: 'on_dodge' }, actionId: '_lingbo_insight_step' }],
        modifiers: ['minMoveCost'],
    },
]

/** 按 ID 查找功法 */
export function getPassive(id: string): Passive | undefined {
    return PASSIVES.find((p) => p.id === id)
}

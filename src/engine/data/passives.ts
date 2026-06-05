import type { Passive, Talent } from '../entities/passive'

/** 功法注册表 */
export const PASSIVES: Passive[] = [
    {
        id: 'forge',
        name: '锻体',
        description: '基础锻体，全属性+1。',
        tags: [],
        effects: [{ type: 'stat_buff', attrs: { strength: 2, vitality: 2, agility: 2, dexterity: 2 } }],
    },
    {
        id: 'iron_bone',
        name: '钢筋铁骨',
        description: '铜皮铁骨。',
        tags: [],
    },
    {
        id: 'spirit_resonance',
        name: '灵器共鸣',
        description: '将自身力道转化为召唤物的攻击力。',
        tags: [],
        effects: [
            { type: 'stat_buff', attrs: { strength: -2 } },
            { type: 'summon_damage_bonus', value: 2 },
        ],
    },
]

/** 天赋（绝学）注册表 */
export const TALENTS: Talent[] = [
    {
        id: 'ling_bo_wei_bu',
        name: '凌波微步',
        description: '绝世轻功，身法达到一定境界后自然领悟。步法精妙，难以捉摸。',
        tags: [],
        requireAttrs: { agility: 18 },
        effects: [],
        triggers: [{ condition: { type: 'on_dodge' }, actionId: '_lingbo_insight_step' }],
        modifiers: ['minMoveCost'],
    },
]

/** 按 ID 查找（功法优先） */
export function getPassive(id: string): Passive | Talent | undefined {
    return PASSIVES.find((p) => p.id === id) ?? TALENTS.find((t) => t.id === id) ?? undefined
}

/** 按 ID 查找天赋 */
export function getTalent(id: string): Talent | undefined {
    return TALENTS.find((t) => t.id === id)
}

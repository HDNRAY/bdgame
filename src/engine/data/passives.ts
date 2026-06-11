import type { Passive, Talent } from '../entities/passive'

/** 功法注册表 */
export const PASSIVES: Passive[] = [
    {
        id: 'forge',
        name: '三分归元气',
        description: '全属性提升。濒危时触发「三分归元」，消耗元气大幅回血。',
        tags: ['qi', 'heal', 'buff'],
        effects: [{ type: 'stat_buff', attrs: { strength: 2, vitality: 2, agility: 2, dexterity: 2 } }],
        triggers: [
            {
                condition: {
                    type: 'hp_below',
                    check: (ctx) => ctx.actor.hp / ctx.actor.maxHp < 0.3,
                },
                actionId: '_sangui_heal',
            },
        ],
    },
    {
        id: 'iron_bone',
        name: '铁布衫',
        description: '铁布衫，吸收伤害。',
        tags: ['qi', 'buff'],
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
    {
        id: 'sword_dominion',
        name: '御剑诀',
        description: '以炁御剑，剑随意动，攻击距离延长。',
        tags: ['imperial', 'qi'],
        effects: [{ type: 'weapon_range_bonus', value: 1 }],
    },
    {
        id: 'nine_deaths',
        name: '九死剑诀',
        description: '虽九死而不悔，伤势越重，剑意越强。',
        tags: ['qi'],
        effects: [{ type: 'last_stand', ratio: 0.5 }],
        modifiers: ['last_stand'],
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

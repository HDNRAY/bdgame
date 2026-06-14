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
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'last_stand', stacks: 0.5 }] },
        ],
    },
    {
        id: 'iaijutsu_mastery',
        name: '居合极意',
        description: '居合拔刀术的极致境界。',
        tags: ['qi'],
        triggers: [{ condition: { type: 'battle_start' }, actionId: '_iaijutsu_ready' }],
    },
    {
        id: 'empty_hand',
        name: '无刀取',
        description: '空手入白刃，非居合状态招架后反击。',
        tags: [],
        triggers: [{ condition: { type: 'on_parry' }, actionId: '_iaijutsu_counter' }],
    },
    {
        id: 'human_radar',
        name: '人体雷达',
        description: '获得居合时锁定目标，下次近距离攻击命中+0.5。',
        tags: [],
        triggers: [
            {
                condition: { type: 'on_buff', buffId: 'iaijutsu' },
                effects: [{ type: 'add_buff', buffId: 'circle' }],
            },
        ],
    },
    {
        id: 'ice_heart',
        name: '冰心诀',
        description: '寒冰之心，万邪不侵。免疫灼烧、冰霜、麻痹。',
        tags: ['passive'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'elemental_immunity' }] },
        ],
    },
    {
        id: 'frost_mastery',
        name: '冰霜诀',
        description: '春雷疾掠，寒气侵骨。劈砍击中80%概率叠加寒冰。',
        tags: ['passive'],
        triggers: [
            { condition: { type: 'on_hit' }, effects: [{ type: 'status', status: 'frost', stacks: 1, chance: 0.8 }] },
        ],
    },

    {
        id: 'ordinary_training',
        name: '平平无奇的锻炼',
        description: '日复一日的刻苦锻炼，身法提升闪避，灵巧提升招架。',
        tags: ['passive'],
        effects: [{ type: 'stat_parry_dodge', parryScale: 0.005, dodgeScale: 0.005 }],
    },
    {
        id: 'momentum_mastery',
        name: '刀势',
        description: '越战越强，每次击中积攒刀势，未命中则丢失。每层刀势提升斩击伤害10%，命中+5%。',
        tags: ['passive'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'momentum', stacks: 1 }] },
            {
                condition: { type: 'on_hit', check: (ctx) => ctx.actor.weaponDef?.tags.includes('slash') ?? false },
                effects: [{ type: 'add_buff', buffId: 'momentum', stacks: 1 }],
            },
            { condition: { type: 'on_dodged' }, effects: [{ type: 'remove_buff', buffId: 'momentum', stacks: 1 }] },
        ],
    },
    {
        id: 'inner_power',
        name: '归元劲',
        description: '内力深厚，悟性反哺四维。每点悟性提升全属性。',
        tags: ['passive'],
        effects: [{ type: 'wisdom_stat_buff', ratio: 0.25, attrs: ['strength', 'vitality', 'agility', 'dexterity'] }],
    },

    {
        id: 'tai_chi_mastery',
        name: '太极',
        description: '太极圆满，以柔克刚。空手可招架，灵巧增益招架减伤。招架后可顺势推掌。',
        tags: ['passive'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'tai_chi' }] },
            { condition: { type: 'on_parry' }, actionId: 'push_palm' },
        ],
    },
]

/** 天赋（绝学）注册表 */
export const TALENTS: Talent[] = [
    {
        id: 'ling_bo_wei_bu',
        name: '凌波微步',
        description: '绝世轻功，身法达到一定境界后自然领悟。步法精妙，身法不低于15。',
        tags: ['talent'],
        requireAttrsMin: { agility: 20 },
        effects: [
            { type: 'attr_floor', attrs: { agility: 15 } },
            { type: 'haste', value: 200 },
        ],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'min_move_cost' }] }],
    },
    {
        id: 'zuoyou_hubo',
        name: '左右互搏',
        description: '双手各自为战，灵巧过人者可一心二用。',
        tags: ['talent'],
        requireAttrsMin: { dexterity: 16 },
        requireAttrsMax: { wisdom: 5 },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'zuoyou_hubo' }] }],
    },
    {
        id: 'vitality_regen',
        name: '生生不息',
        description: '根骨强健，每 3 秒回复 1% 生命。',
        tags: ['heal', 'talent'],
        requireAttrsMin: { vitality: 18 },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'vitality_regen' }] }],
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

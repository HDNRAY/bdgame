import type { Passive, Talent } from '../entities/passive'
import { hasBuff } from '../combat/utils'
import { Tag } from '../entities/tag'

/** 功法注册表 */
export const PASSIVES: Passive[] = [
    {
        id: 'forge',
        name: '三分归元气',
        description: '全属性提升。濒危时触发「三分归元」，消耗元气大幅回血。',
        tags: ['qi', 'heal', 'buff', 'defense'],
        effects: [{ type: 'stat_buff', attrs: { strength: 1, vitality: 1, agility: 1, dexterity: 1 } }],
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
        tags: ['qi', 'buff', 'defense'],
    },
    {
        id: 'spirit_resonance',
        name: '灵器共鸣',
        description: '将自身力道转化为召唤物的攻击力。',
        tags: ['summon'],
        effects: [
            { type: 'stat_buff', attrs: { strength: -2 } },
            { type: 'summon_damage_bonus', value: 2 },
        ],
    },
    {
        id: 'sword_dominion',
        name: '御剑诀',
        description: '以炁御剑，剑随意动，攻击距离延长。',
        tags: ['imperial', 'qi', 'range', 'range_up'],
        effects: [{ type: 'weapon_range_bonus', value: 2 }],
    },
    {
        id: 'nine_deaths',
        name: '九死剑诀',
        description: '虽九死而不悔，伤势越重，剑意越强。',
        tags: ['qi', 'damage'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'last_stand', stacks: 0.3 }] },
        ],
    },
    {
        id: 'iaijutsu_mastery',
        name: '居合极意',
        description: '居合拔刀术的极致境界。',
        tags: ['qi', 'stance'],
        triggers: [
            { condition: { type: 'battle_start' }, actionId: '_iaijutsu_ready' },
            {
                condition: {
                    type: 'on_parry',
                    check: (ctx) => hasBuff(ctx.engine!, ctx.actor.id, 'iaijutsu'),
                },
                effects: [{ type: 'add_buff', buffId: 'iaijutsu_focus', stacks: 1 }],
            },
            {
                condition: {
                    type: 'on_dodge',
                    check: (ctx) => hasBuff(ctx.engine!, ctx.actor.id, 'iaijutsu'),
                },
                effects: [{ type: 'add_buff', buffId: 'iaijutsu_focus', stacks: 1 }],
            },
        ],
    },
    {
        id: 'empty_hand',
        name: '无刀取',
        description: '空手入白刃，非居合状态招架后反击。',
        tags: ['counter'],
        triggers: [
            {
                condition: {
                    type: 'on_parry',
                    check: (ctx) => !hasBuff(ctx.engine!, ctx.actor.id, 'iaijutsu'),
                },
                actionId: '_iaijutsu_counter',
            },
        ],
    },
    {
        id: 'human_radar',
        name: '人体雷达',
        description: '获得居合时锁定目标，下次近距离攻击命中+0.5。',
        tags: ['buff'],
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
        tags: ['passive', 'defense'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'elemental_immunity' }] },
        ],
    },
    {
        id: 'frost_mastery',
        name: '冰霜诀',
        description: '春雷疾掠，寒气侵骨。劈砍击中80%概率叠加寒冰。',
        tags: ['passive', 'debuff'],
        triggers: [
            {
                condition: { type: 'on_hit' },
                effects: [{ type: 'add_debuff', buffId: 'frost', stacks: 1, chance: 0.8 }],
            },
        ],
    },

    {
        id: 'ordinary_training',
        name: '平平无奇的锻炼',
        description: '日复一日的刻苦锻炼，身法提升闪避，灵巧提升招架。',
        tags: ['passive', 'defense'],
        effects: [{ type: 'stat_parry_dodge', parryScale: 0.005, dodgeScale: 0.005 }],
    },
    {
        id: 'momentum_mastery',
        name: '刀势',
        description: '越战越强，每次击中积攒刀势，未命中则丢失。每层刀势提升斩击伤害10%，命中+5%。',
        tags: ['passive', 'damage', 'buff'],
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
        id: 'overlord_art',
        name: '霸刀刀法',
        description: '霸刀巨刃配合离心力，每一刀都顺势回旋突进。',
        tags: ['passive', 'damage', 'stance'],
        effects: [],
        actionEnhancer: (def) => {
            if (!def.tags.includes('slash')) return def
            return { ...def, effects: [{ type: 'short_dash', maxDistance: 2 }, ...(def.effects ?? [])] }
        },
    },
    {
        id: 'inner_power',
        name: '归元劲',
        description: '内力深厚，悟性反哺四维。每点悟性提升全属性。',
        tags: ['passive', 'buff'],
        effects: [{ type: 'wisdom_stat_buff', ratio: 0.1, attrs: ['strength', 'vitality', 'agility', 'dexterity'] }],
    },

    {
        id: 'tai_chi_mastery',
        name: '太极',
        description: '太极圆满，以柔克刚。空手可招架，灵巧增益招架减伤。招架后可顺势推掌。',
        tags: ['passive', 'counter', 'defense'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'tai_chi' }] },
            { condition: { type: 'on_parry' }, actionId: 'push_palm' },
        ],
    },
    {
        id: 'dimensional_blade_mastery',
        name: '次元刃',
        description: '次元之力削弱招架，被招架时减伤效果大幅降低。',
        tags: ['passive', 'debuff'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'dimensional_blade' }],
            },
        ],
    },
    {
        id: 'godspeed',
        name: '神速',
        description: '以电刺激神经，身法灵巧大幅提升。',
        tags: ['passive', 'buff', 'electric'],
        effects: [{ type: 'stat_buff', attrs: { insight: 2, dexterity: 2 } }],
        triggers: [{ condition: { type: 'on_dodge' }, actionId: '_godspeed_counter' }],
    },
    {
        id: 'thunder_art',
        name: '雷法',
        description: '雷电之力灌注全身，攻击附带雷击伤害，并概率麻痹对手。',
        tags: ['passive', 'buff', 'electric'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'thunder_bonus' }] }],
        actionEnhancer: (def) => {
            if (!def.effects?.some((e) => e.type === 'damage')) return def
            if (!def.tags.includes('blunt')) return def
            const chance = Math.min(0.8, def.apCost * 0.15)
            // 如果招式已有麻痹效果，合并概率（加法）
            const idx = def.effects!.findIndex(
                (e): e is Extract<typeof e, { type: 'add_debuff' }> =>
                    e.type === 'add_debuff' && e.buffId === 'paralyze',
            )
            if (idx >= 0) {
                const merged = {
                    ...(def.effects![idx] as Extract<(typeof def.effects)[number], { type: 'add_debuff' }>),
                }
                merged.chance = merged.chance + chance
                const newEffects = [...def.effects!]
                newEffects[idx] = merged
                return { ...def, effects: newEffects }
            }
            return {
                ...def,
                effects: [...(def.effects ?? []), { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance }],
            }
        },
    },
    {
        id: 'zoldyck_art',
        name: '揍敌客秘法',
        description: '揍敌客家族世代相传的暗杀术，雷电锻体，免疫麻痹并减免雷系伤害。',
        tags: ['passive', 'buff', 'electric'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [
                    { type: 'add_buff', buffId: 'paralyze_immunity' },
                    { type: 'add_buff', buffId: 'thunder_constitution' },
                ],
            },
        ],
    },
    {
        id: 'qiti_source',
        name: '炁体源流',
        description: '八奇技之一，濒危时炁体护体吸收炁伤害，并将悟性转化为力量、身法和灵巧。',
        tags: ['passive', 'buff', 'qi'],
        requireAttrsMin: { wisdom: 16 },
        triggers: [
            {
                condition: {
                    type: 'hp_below',
                    check: (ctx) => ctx.actor.hp / ctx.actor.maxHp < 0.25,
                },
                actionId: '_qiti_awaken',
            },
        ],
    },
    {
        id: 'dark_room_catch',
        name: '暗室抓雀功',
        description: '古墓中蒙眼抓雀练就的身法与感知。身法+2，灵巧+2，免疫迷眼。',
        tags: ['passive', 'buff', 'defense'],
        effects: [{ type: 'stat_buff', attrs: { agility: 2, dexterity: 2 } }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'dark_room_sense' }] }],
    },
    {
        id: 'yue_nv_sword',
        name: '越女剑法',
        description: '白猿授剑，万兵为剑。刀枪棍棒在手亦是剑法，出剑极快，身随剑走，灵巧愈高剑势愈利。',
        tags: ['buff', 'passive'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'yue_nv_buff' }] }],
        actionEnhancer: (def) => {
            if (!def.effects?.some((e) => e.type === 'damage')) return def
            return {
                ...def,
                tags: [...new Set<Tag>([...def.tags, 'pierce'])],
                extraPreDelay: (def.extraPreDelay ?? 0) - 150,
                effects: [{ type: 'short_dash', maxDistance: 1 }, ...(def.effects ?? [])],
            }
        },
    },

    // ── 杨过 ──
    {
        id: 'one_arm',
        name: '独臂',
        description: '断臂之人，无法双持。单臂运劲更凝练，招式消耗降低1AP（最低1）。',
        tags: ['passive', 'debuff'],
        effects: [{ type: 'stat_buff', attrs: { agility: -2 } }],
        actionEnhancer: (def) => ({
            ...def,
            apCost: Math.max(1, def.apCost - 1),
        }),
    },
    {
        id: 'dark_iron_sword_art',
        name: '玄铁剑法',
        description: '玄铁重剑无锋无刃，运劲之法迥异常理。以力驭剑，身法负担减半。',
        tags: ['passive', 'buff', 'stance'],
        effects: [{ type: 'halve_weapon_penalty' }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'heavy_training' }] }],
    },
    {
        id: 'tide_inner_power',
        name: '潮汐内力',
        description: '内力如潮汐般涨落，每回合交替以力道或身法驱动招式。悟性+2。',
        tags: ['passive', 'buff', 'qi'],
        effects: [{ type: 'stat_buff', attrs: { wisdom: 2 } }],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'tide_power', stacks: 0 }] },
        ],
    },
]

/** 天赋（绝学）注册表 */
export const TALENTS: Talent[] = [
    {
        id: 'ling_bo_wei_bu',
        name: '凌波微步',
        description: '绝世轻功，身法达到一定境界后自然领悟。步法精妙，身法不低于15。',
        tags: ['talent', 'buff'],
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
        tags: ['talent', 'buff'],
        requireAttrsMin: { dexterity: 18 },
        requireAttrsMax: { wisdom: 5 },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'zuoyou_hubo' }] }],
    },
    {
        id: 'vitality_regen',
        name: '生生不息',
        description: '根骨强健，每 1 秒回复 1% 生命。',
        tags: ['heal', 'talent', 'buff'],
        requireAttrsMin: { vitality: 20 },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'vitality_regen' }] }],
    },
    {
        id: 'xiaowuxiang',
        name: '小无相功',
        description: '洞察入微，以彼之道还施彼身。缠劲满溢时窥破对手功法破绽，复制其最契合自身武道的功法。',
        tags: ['talent', 'buff'],
        requireAttrsMin: { insight: 20 },
        triggers: [{ condition: { type: 'chan_overflow' }, actionId: '_xiaowuxiang_copy' }],
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

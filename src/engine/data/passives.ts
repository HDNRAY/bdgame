import type { Passive, Talent } from '../entities/passive'
import { hasBuff, hasNoStance } from '../combat/utils'
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
        description: '铁布衫，所受直伤-20%。',
        tags: ['qi', 'buff', 'defense'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'iron_defense' }] }],
    },
    {
        id: 'spirit_resonance',
        name: '灵器共鸣',
        description: '将自身力道转化为召唤物的攻击力。',
        tags: ['summon'],
        effects: [
            { type: 'stat_buff', attrs: { strength: -2 } },
            { type: 'summon_damage_bonus', value: 4 },
        ],
    },
    {
        id: 'sword_dominion',
        name: '御剑诀',
        description: '以炁御剑，剑随意动。无需从小以炁养物，估故仅能延长攻击距离。',
        tags: ['imperial', 'qi', 'range_up'],
        effects: [{ type: 'weapon_range_bonus', value: 2, requireWeaponTag: 'imperial' }],
    },
    {
        id: 'nine_deaths',
        name: '九死剑诀',
        description: '虽九死而不悔，伤势越重，剑意越强。',
        tags: ['qi', 'damage'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'last_stand', stacks: 0.25 }],
            },
        ],
    },
    {
        id: 'iaijutsu_mastery',
        name: '居合道',
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
        id: 'extreme',
        name: '极',
        description: '蓄势至极，一击必杀。使用≥5AP招式时若缠劲已满：必中，每层缠劲增伤1%。',
        tags: ['passive', 'buff'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'extreme' }] }],
    },
    {
        id: 'qi_edge',
        name: '炁刃',
        description: '以炁凝刃，刀剑延长斩击距离，蕴含炁劲。slash招式AP+1，范围+2，附加推演伤害。',
        tags: ['passive', 'qi'],
        actionEnhancer: (def) => {
            if (!def.tags.includes('slash')) return def
            return {
                ...def,
                apCost: def.apCost + 1,
                getRange: (wr) => [wr[0], Math.min(10, wr[1] + 1)] as [number, number],
                effects: (def.effects ?? []).map((e) => {
                    if (e.type === 'damage') return { ...e, scaling: { ...e.scaling, wisdom: 0.2 } }
                    return e
                }),
            }
        },
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
                    check: (ctx) => hasNoStance(ctx.engine!.state.pendingBuffs, ctx.actor.id),
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
                condition: { type: 'on_stance' },
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
        tags: ['passive', 'damage'],
        effects: [],
        actionEnhancer: (def) => {
            if (!def.tags.includes('slash')) return def
            return { ...def, effects: [{ type: 'short_dash', maxDistance: 2 }, ...(def.effects ?? [])] }
        },
    },
    {
        id: 'inner_power',
        name: '归元劲',
        description: '内力深厚，。每点推演提升全属性。',
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
            if (!def.tags.includes('unarmed')) return def
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
        description: '八奇技之一，濒危时炁体护体吸收炁伤害，并将炁转化为力量、身法和灵巧。',
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
        id: 'stance_armor',
        name: '罡体',
        description: '进入架势时罡气护体，2秒内免疫眩晕、击退、打断、缴械、击倒。',
        tags: ['buff', 'defense'],
        triggers: [
            {
                condition: { type: 'on_stance' },
                effects: [{ type: 'add_buff', buffId: 'stance_armor' }],
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
                extraPreDelay: (def.extraPreDelay ?? 0) - 100,
                effects: [{ type: 'short_dash', maxDistance: 1 }, ...(def.effects ?? [])],
            }
        },
    },

    // ── 杨过 ──
    {
        id: 'one_arm',
        name: '独臂',
        description: '总有断臂之人不喜义体。无法双持。运劲更凝练，招式消耗降低1AP（最低1）。',
        tags: ['passive', 'debuff', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { agility: -2 } }],
        actionEnhancer: (def) => ({
            ...def,
            apCost: Math.max(1, def.apCost - 1),
        }),
    },
    {
        id: 'dark_iron_sword_art',
        name: '玄铁剑法',
        description:
            '玄门流落在外的秘籍，虽无玄门血脉，亦可以炁御物。无法精巧控制武器，但可降低重武器对修炼者身法的负面影响，并使其可以短暂使用拳脚攻击。',
        tags: ['passive', 'buff', 'heavy'],
        effects: [
            {
                type: 'stat_restriction',
                check: (_char, attr, _cur, delta, sourceTags) => {
                    if (attr === 'agility' && delta < 0 && sourceTags?.includes('weapon'))
                        return { delta: Math.round(delta / 2) }
                    return null
                },
            },
            { type: 'weapon_tag', tag: 'unarmed' },
        ],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'heavy_training' }] }],
    },
    {
        id: 'tide_inner_power',
        name: '潮汐内力',
        description: '内力如潮汐般涨落，每回合交替以力道或身法驱动招式。',
        tags: ['passive', 'buff', 'qi'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'tide_power', stacks: 0 }] },
        ],
    },
    {
        id: 'shenxing_baibian',
        name: '神行百变',
        description: '铁剑门绝学，身法灵动百变，极难捉摸。',
        tags: ['passive', 'buff', 'defense'],
        effects: [
            { type: 'dodge_mod', value: 0.08 },
            { type: 'haste', eval: (char) => char.attrs.get('wisdom') * 10 },
        ],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'min_move_cost' }] }],
    },
    {
        id: 'xuannv_sword',
        name: '玄女剑法',
        description: '独臂神尼所创上乘剑法，以巧借力、以奇制胜，灵巧化为力道。',
        tags: ['passive', 'buff'],
        effects: [{ type: 'dex_to_str', ratio: 0.25 }],
    },
    {
        id: 'stone_skin',
        name: '石肤',
        description: '肌肤如岩石般坚硬，所受直伤-10%。免疫灼烧。',
        tags: ['passive', 'defense', 'buff'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'stone_skin' }] }],
    },
    {
        id: 'qishier_bian',
        name: '七十二变',
        description: '地煞七十二变，夺天地之造化。每6秒轮流使力道、体质、身法、灵巧增加3点。',
        tags: ['passive', 'buff'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'qishier_bian', stacks: 0 }] },
        ],
    },
    {
        id: 'hua_gun',
        name: '花棍',
        description: '以灵巧驾驭长兵，棍花如屏，可格挡远程攻击。灵巧越高招架远程越强。',
        tags: ['passive', 'defense'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'hua_gun_parry' }] }],
    },
    {
        id: 'frost_step_mastery',
        name: '踏雪',
        description: '踏雪如履平地，身法轻灵，移动效率+50%。',
        tags: ['passive', 'buff'],
        effects: [{ type: 'move_efficiency', value: 0.5 }],
    },
    {
        id: 'yuxin_sword_mastery',
        name: '真假无用剑法',
        description: '双剑合璧，刚柔并济。所有可叠层 buff 上限+2。',
        tags: ['qi', 'passive', 'buff'],
        requireAttrsMin: {},
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'yuxin_sword_mastery' }] },
        ],
    },
    {
        id: 'lingxi_finger',
        name: '灵犀一指',
        description: '陆小凤绝学，空手亦可夹住兵刃。灵巧+4，徒手可招架。',
        tags: ['passive', 'buff', 'defense'],
        effects: [{ type: 'stat_buff', attrs: { dexterity: 4 } }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'lingxi_finger' }] }],
    },
    {
        id: 'yedi_lightness',
        name: '夜帝轻功',
        description: '夜帝亲传轻功，雁迥掠影，来去如风。',
        tags: ['passive', 'buff'],
        effects: [],
        grantsActions: ['yan_hui', 'yan_fan'],
    },
    {
        id: 'beiming',
        name: '北冥神功',
        description: '北冥之渊，吞噬万物。命中时汲取敌方推演 1 点，持续 5 秒。',
        tags: ['passive', 'buff', 'qi'],
        triggers: [
            {
                condition: { type: 'on_hit' },
                effects: [{ type: 'stat_transfer', stat: 'wisdom', value: 1, duration: 5000 }],
            },
        ],
    },
    {
        id: 'golden_light',
        name: '金光咒',
        description: '金光护体，AP上限-1；受伤时消耗1层缠劲减免3点。',
        tags: ['passive', 'buff', 'defense', 'qi'],
        effects: [{ type: 'max_ap_mod', value: -1 }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'golden_light' }] }],
    },
    {
        id: 'martial_arts_archive',
        name: '活武学宝典',
        description: '通晓天下武学，以推演预判对手。闪/招→叠暴击；暴击→叠闪/招。',
        tags: ['passive', 'buff'],
        effects: [{ type: 'stat_buff', attrs: { insight: 2 } }],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'martial_arts_archive' }],
            },
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
            { type: 'attr_floor', attrs: { agility: 16 } },
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
        requireAttrsMax: { wisdom: 4 },
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
        id: 'xiu_li_xuan_ji',
        name: '袖里玄机',
        description: '千丝万缕，只在他衣袖之间。闪避获得1层缠劲；受伤消耗1层缠劲减免3点。',
        tags: ['talent', 'buff', 'qi'],
        requireAttrsMin: { wisdom: 20 },
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'xiu_li' }] },
            { condition: { type: 'on_dodge' }, effects: [{ type: 'add_buff', buffId: 'xuan_ji', stacks: 1 }] },
            { condition: { type: 'on_action_trigger' }, effects: [{ type: 'add_buff', buffId: 'xuan_ji', stacks: 1 }] },
            {
                condition: {
                    type: 'on_buff',
                    buffId: 'xuan_ji',
                    check: (ctx) => {
                        const layer = ctx.engine?.state.pendingBuffs.get(`xuan_ji::${ctx.actor.id}`)
                        return !!layer && layer.restoreValue >= 15
                    },
                },
                effects: [{ type: 'add_buff', buffId: 'tianji_ready' }],
            },
        ],
    },
    {
        id: 'xiaowuxiang',
        name: '斗转星移',
        description: '洞察入微，以彼之道还施彼身。缠劲满溢时窥破对手功法破绽，复制其最契合自身武道的功法。',
        tags: ['talent', 'buff'],
        requireAttrsMin: { insight: 20 },
        triggers: [{ condition: { type: 'chan_overflow' }, actionId: '_xiaowuxiang_copy' }],
    },
    {
        id: 'yuanting_yuezhi',
        name: '渊渟岳峙',
        description: '渊深如潭，岳峙如山。永久罡体，身法/灵巧无法被降低。',
        tags: ['talent', 'buff', 'defense'],
        requireAttrsMin: { strength: 20 },
        effects: [
            {
                type: 'stat_restriction',
                check: (_char, attr, _cur, delta) => {
                    if ((attr === 'agility' || attr === 'dexterity') && delta < 0) return { skip: true }
                    return null
                },
            },
        ],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'yuanting_yuezhi' }] }],
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

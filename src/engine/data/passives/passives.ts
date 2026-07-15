import type { Passive } from '../../entities/passive'
import { hasBuff } from '../../combat/utils'
import { getWeapon } from '../weapons/weapons'
import { Tag } from '../../entities/tag'

export const PASSIVES: Passive[] = [
    {
        id: 'forge',
        name: '三分归元气',
        description: '全属性提升。濒危时触发「三分归元」，消耗元气大幅回血。',
        tags: ['qi', 'heal', 'buff', 'defense'],
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
        description: '铁布衫，所受直伤-20%。',
        tags: ['qi', 'buff', 'defense'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'iron_defense' }] }],
    },
    {
        id: 'spirit_resonance',
        name: '灵器共鸣',
        description: '将自身力道转化为召唤物的攻击力。',
        tags: ['summon'],
        effects: [{ type: 'stat_buff', attrs: { strength: -2 } }],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'spirit_resonance_buff', stacks: 1 }],
            },
        ],
    },
    {
        id: 'sword_dominion',
        name: '御剑诀',
        description: '以炁御剑，剑随意动。延长攻击距离。',
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
                effects: [{ type: 'add_buff', buffId: 'last_stand', stacks: 0.3 }],
            },
        ],
    },
    {
        id: 'iaijutsu_mastery',
        name: '居合道',
        description: '居合拔刀术的极致境界。习得居合斩与纳刀。',
        tags: ['qi', 'stance'],
        grantsActions: ['iaijutsu_strike', 'resheath'],
        triggers: [{ condition: { type: 'battle_start' }, actionId: '_iaijutsu_ready' }],
    },
    {
        id: 'dragon_palace_style',
        name: '龙宫院流',
        description: '龙宫院秘传剑术，招架或闪避后蓄势，叠加居合·势。',
        tags: ['passive', 'counter'],
        triggers: [
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
        description: '蓄势至极，一击必杀。缠劲满时获得极状态，下次≥5AP招式消耗所有缠劲，每层+1%暴击率和+2%暴伤。',
        tags: ['passive', 'buff'],
        triggers: [
            {
                condition: {
                    type: 'chan_overflow',
                },
                effects: [{ type: 'add_buff', buffId: 'extreme' }],
            },
        ],
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
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'ordinary_training' }] },
        ],
    },
    {
        id: 'momentum_mastery',
        name: '刃炁大师',
        requiredTags: ['slash'],
        description: '刃炁入体，每层受到伤害+5%。受到治疗时减少一层（累计10点治疗消一层）。',
        tags: ['passive', 'damage', 'debuff', 'slash'],
        triggers: [
            {
                condition: { type: 'on_hit', check: (ctx) => ctx.actor.weaponDef?.tags.includes('slash') ?? false },
                effects: [{ type: 'add_debuff', buffId: 'blade_qi', stacks: 1, chance: 1 }],
            },
        ],
    },
    {
        id: 'overlord_art',
        name: '霸刀刀法',
        description: '霸刀巨刃配合离心力，每一刀都顺势回旋突进。',
        tags: ['passive', 'damage'],
        effects: [],
        grantsActions: ['retrieve_blade'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'overlord_art_buff' }] },
        ],
        actionEnhancer: (def) => {
            if (!def.tags.includes('slash')) return def
            return { ...def, effects: [{ type: 'short_dash', maxDistance: 2 }, ...(def.effects ?? [])] }
        },
    },
    {
        id: 'inner_power',
        name: '归元劲',
        description: '内力深厚。每点推演提升全属性。',
        tags: ['passive', 'buff'],
        effects: [{ type: 'wisdom_stat_buff', ratio: 0.1, attrs: ['strength', 'vitality', 'agility', 'dexterity'] }],
    },

    {
        id: 'tai_chi_mastery',
        name: '太极',
        description: '太极圆满，以柔克刚。空手可招架，灵巧增益招架减伤。招架后可顺势推掌。',
        tags: ['passive', 'counter', 'defense'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'nuo_yi' }] },
            { condition: { type: 'on_parry' }, actionId: 'push_palm' },
        ],
    },
    {
        id: 'godspeed',
        name: '疾风迅雷',
        description: '神经电刺激，闪避后蓄势，被击中时雷闪反击。',
        tags: ['passive', 'buff', 'electric'],
        triggers: [
            { condition: { type: 'on_dodge' }, effects: [{ type: 'add_buff', buffId: 'thunder_swift', stacks: 1 }] },
            { condition: { type: 'on_was_hit' }, actionId: '_godspeed_counter' },
        ],
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
        requireAttrsMin: { wisdom: 14 },
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
        id: 'stance_time',
        name: '转换时刻',
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
        id: 'weapon_stance',
        name: '行云流水',
        description: '每次切换武器自动进入对应架势。',
        tags: ['passive', 'buff'],
        triggers: [
            {
                condition: {
                    type: 'on_weapon_change',
                    check: (ctx) => {
                        const w = ctx.actor.weaponDef ?? getWeapon(ctx.actor.build.weapon)
                        return w.tags.includes('polearm')
                    },
                },
                effects: [
                    { type: 'remove_buff', buffId: 'melee_stance' },
                    { type: 'remove_buff', buffId: 'fist_stance' },
                    { type: 'add_buff', buffId: 'polearm_stance' },
                ],
            },
            {
                condition: {
                    type: 'on_weapon_change',
                    check: (ctx) => {
                        const w = ctx.actor.weaponDef ?? getWeapon(ctx.actor.build.weapon)
                        return w.tags.includes('melee')
                    },
                },
                effects: [
                    { type: 'remove_buff', buffId: 'polearm_stance' },
                    { type: 'remove_buff', buffId: 'fist_stance' },
                    { type: 'add_buff', buffId: 'melee_stance' },
                ],
            },
            {
                condition: {
                    type: 'on_weapon_change',
                    check: (ctx) => {
                        const w = ctx.actor.weaponDef ?? getWeapon(ctx.actor.build.weapon)
                        return w.tags.includes('unarmed')
                    },
                },
                effects: [
                    { type: 'remove_buff', buffId: 'polearm_stance' },
                    { type: 'remove_buff', buffId: 'melee_stance' },
                    { type: 'add_buff', buffId: 'fist_stance' },
                ],
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
        id: 'frost_step',
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
        description: '陆小凤绝学，空手入白刃，招架时缴械对手。灵巧+4，徒手可招架。',
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
        description: '金光护体，AP上限-1；受伤时消耗1层缠劲减免3点；非御物攻击消耗1层缠劲附加2点伤害。',
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
    {
        id: 'sword_intent_tempering',
        name: '剑意淬体',
        description: '剑意淬炼肉身，减免slash/pierce伤害25%，且单次受伤不超过最大生命的25%。',
        tags: ['passive', 'buff', 'defense'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'sword_intent_tempering' }] },
        ],
    },
    {
        id: 'yu_du_shu',
        name: '毒炁外泄',
        description: '毒雾护体，每10秒释放毒素。血量充裕时仅降对手推演；受伤过重时毒雾失控。',
        tags: ['passive', 'buff', 'poison'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'yu_du_shu' }] }],
    },
    {
        id: 'tongtian',
        name: '通天',
        description: '悟生离死别，所有伤害受推演按AP加成。',
        tags: ['passive', 'buff', 'qi'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'tongtian' }] }],
    },
    {
        id: 'no_parry_style',
        name: '流风回雪',
        description: '飘飖兮若流风之回雪。不招架，只闪避，将招架率转化为等额的闪避率。',
        tags: ['qi', 'buff', 'defense'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'no_parry_buff' }] }],
    },
    {
        id: 'quick_glance',
        name: '匆匆一瞥',
        description: '惊鸿一瞥，杀机已至。提升暴击伤害，附带招式「顺水推舟」。',
        tags: ['qi', 'buff'],
        grantsActions: ['follow_the_current'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'quick_glance_buff' }] },
        ],
    },
    {
        id: 'draw_sword_cut_water',
        name: '抽刀断水',
        description: '抽刀断水水更流。交替使用不同斩击招式可叠加增伤，重复使用同一招则重置。',
        tags: ['qi', 'buff'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'draw_sword_combo_buff' }] },
        ],
    },
    {
        id: 'jing_luo_chu_jian',
        name: '经络初鉴',
        description: '熟稔经络，洞察弱点。每点洞察增加1%暴击率。',
        tags: ['passive', 'buff'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'jing_luo_chu_jian' }] },
        ],
    },
    {
        id: 'dian_xue_passive',
        name: '灵枢真解',
        description: '灵枢真解，点穴封脉。拳脚及钝击招式均有40%概率造成4层麻痹。',
        tags: ['passive', 'debuff'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'ling_xu_zhen_jie' }] },
        ],
    },
    {
        id: 'li_wu_xu_fa',
        name: '例无虚发',
        description: '所有暗器招式命中率+50%。',
        tags: ['passive', 'buff'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'li_wu_xu_fa' }] }],
    },
    // ── 酒鬼·无志 ──
    {
        id: 'zui_quan',
        name: '醉拳',
        description: '醉态蹒跚，步法诡谲。徒手招式附带短距冲刺，闪避率+8%。',
        tags: ['passive', 'buff', 'jiu'],
        actionEnhancer: (def) => {
            if (!def.tags?.includes('unarmed') || !def.effects?.some((e) => e.type === 'damage')) return def
            return { ...def, effects: [{ type: 'short_dash', maxDistance: 1 }, ...def.effects] }
        },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'zui_quan_dodge' }] }],
    },
    {
        id: 'jiu_yang_shen_gong',
        name: '九阳神功',
        description: '九阳真气护体，AP恢复速度提升至1.5倍。',
        tags: ['passive', 'buff'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'nei_xi_peng_pai', stacks: 5 }],
            },
        ],
    },
    {
        id: 'hun_yuan_gong',
        name: '混元功',
        description: '混元护体，近身受到超过8点或炁伤害时反伤并击退对手。',
        tags: ['passive', 'qi', 'defense'],
        triggers: [
            {
                condition: { type: 'on_was_hit', check: (ctx) => ctx.distance <= 1 },
                actionId: '_hun_yuan_reflect',
            },
        ],
    },
    {
        id: 'qian_kun_da_nuo_yi',
        name: '乾坤大挪移',
        description: '醉态中身体不受控制地晃动，受击时15%概率将所受伤害全额反弹。',
        tags: ['passive', 'defense'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'qian_kun_fan_tan' }],
            },
        ],
    },
    {
        id: 'sword_focus',
        name: '怒炁充盈',
        description: '每被闪避一次积攒怒气，下次命中附加 层数×3 点伤害，击中后重置。',
        tags: ['passive', 'buff'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'sword_focus' }] }],
    },
    {
        id: 'drunken_step',
        name: '醉仙望月步',
        description: '每次饮酒时，获得15%闪避，持续15秒。',
        tags: ['passive', 'defense', 'buff', 'jiu'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'drunken_step_watcher' }],
            },
        ],
    },
    {
        id: 'ningqi_jue',
        name: '凝炁诀',
        description: '以炁劲贯通全身，全属性+1，所有招式带炁。',
        tags: ['passive', 'qi'],
        effects: [{ type: 'stat_buff', attrs: { strength: 1, vitality: 1, agility: 1, dexterity: 1, insight: 1 } }],
        actionEnhancer: (def) => {
            if (def.tags?.includes('qi')) return def
            return { ...def, tags: [...(def.tags ?? []), 'qi'] }
        },
    },
    {
        id: 'sword_capture',
        name: '无刀取',
        description: '空手入白刃。获得1个额外触发槽，空手可招架，招架成功后有50%概率缴械对手。',
        tags: ['buff', 'defense'],
        effects: [{ type: 'trigger_slot_mod', value: 1 }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'sword_capture' }] }],
    },
    {
        id: 'ru_yi_jin',
        name: '如意劲',
        description: '暴击时消耗3层缠劲，按灵巧增加暴击伤害。',
        tags: ['passive', 'buff'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'ru_yi_jin' }] }],
    },
    {
        id: 'blood_rage',
        name: '血战到底',
        description: '气血越低属性加成越高。力道、身法、灵巧随血量减少而提升。',
        tags: ['passive', 'buff'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'blood_rage' }] }],
    },
    {
        id: 'fei_hua_shou',
        name: '飞花手',
        description: '暗器出手如飞花，可连续追加投掷攻击。',
        tags: ['buff'],
        requireAttrsMin: { dexterity: 16 },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'fei_hua_shou' }] }],
    },
    {
        id: 'wheelchair_lightness',
        name: '轮椅轻功',
        description: '无情秘传轮椅术，以炁驱轮，如履平地。移动效率+50%。',
        tags: ['passive', 'buff'],
        effects: [{ type: 'move_efficiency', value: 0.5 }],
    },
    {
        id: 'sekai_heroism',
        name: '世一英雄主义',
        description: '并非好胜，只是有人需要她赢。根骨-2，身法+2、灵巧+2、洞察+2。',
        tags: ['passive', 'buff'],
        effects: [{ type: 'stat_buff', attrs: { vitality: -2, agility: 2, dexterity: 2, insight: 2 } }],
    },
    {
        id: 'combat_instinct',
        name: '战斗本能',
        description: '每4点洞察增加1触发槽。',
        tags: ['passive', 'buff'],
        effects: [{ type: 'trigger_slot_mod', fn: (char) => Math.floor(char.attrs.get('insight') / 4) }],
    },
    {
        id: 'insight_awareness',
        name: '料敌机先',
        description: '洞察入微，洞察越高招架/闪避越强。',
        tags: ['passive', 'buff'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'combat_instinct' }] }],
    },
    {
        id: 'wolf_hunting',
        name: '狼狩',
        description:
            '善用自重、惯性与借力造成毁灭性打击。polearm/slash招式附加（根骨×0.1+身法×0.1+灵巧×0.1）额外伤害。',
        tags: ['passive', 'buff'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'wolf_hunting_buff' }] },
        ],
    },
    {
        id: 'no_way_win',
        name: '无招胜有招',
        description: '不拘泥一板一眼的招式，任何触发招式伤害+15。',
        tags: ['passive', 'buff'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'no_way_win_buff' }] }],
    },
    {
        id: 'spear_stance_mastery',
        name: '三节枪术',
        description: '出招前切攻势，收招后切守势。',
        tags: ['passive', 'buff'],
        triggers: [
            { condition: { type: 'turn_start' }, actionId: 'spear_break' },
            { condition: { type: 'turn_end' }, actionId: 'spear_guard' },
        ],
    },
    // ── 药屋·黛玄 ──
    {
        id: 'ni_zhuan_jing_mai',
        name: '逆转经脉',
        description: '逆转经脉运行，概率抵抗麻痹，降低被暴击率。',
        tags: ['passive', 'defense'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'ni_zhuan_jing_mai' }] },
        ],
    },
    {
        id: 'luo_ying_shen_jian',
        name: '落英神剑',
        description: '所有伤害的30%寄存于神剑印记内（消耗1缠劲），5层满时爆发2倍伤害。',
        tags: ['passive', 'buff', 'qi'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'luo_ying_shen_jian_buff' }],
            },
        ],
    },
    {
        id: 'enhanced_vision',
        name: '超强感知',
        description: '失聪后锻炼出的超强视觉与触觉。洞察+2，招架时以敏锐感知进一步化解伤害。',
        tags: ['passive', 'buff', 'defense'],
        effects: [{ type: 'stat_buff', attrs: { insight: 4 } }],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'enhanced_vision_buff' }] },
        ],
    },
    // ── 炁电转换（天工·千星） ──
    {
        id: 'qi_electric_conversion',
        name: '炁电转换',
        description: '以炁驱动装备，每件craft/implant装备提升属性。',
        tags: ['passive', 'buff', 'electric', 'craft'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'qi_electric_buff' }],
            },
        ],
    },
]

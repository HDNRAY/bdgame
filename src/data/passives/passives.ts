import type { Passive } from '../../engine/entities/passive'
import { getWeapon } from '../weapons/weapons'
import { Tag } from '../../engine/entities/tag'

export const PASSIVES: Passive[] = [
    {
        id: 'forge',
        name: '三分归元气',
        description: '元气充盈，全属性提升。濒危时触发「三分归元」，消耗元气大幅回血。',
        tags: ['qi', 'heal', 'buff', 'defense', 'low_hp'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'sangui_yuanqi' }],
            },
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
        description: '铁布衫，所受直伤-15%。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'iron_defense' }],
            },
        ],
    },
    {
        id: 'ji_lie_zhi_lie',
        name: '极烈之烈',
        description: '死战不退，受击愈烈。每次受到伤害叠1层「烈」，每层提升暴击率与暴击伤害。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ji_lie_zhi_lie_buff' }],
            },
        ],
    },
    {
        id: 'spirit_resonance',
        name: '灵器共鸣',
        description: '将自身力道转化为召唤物的攻击力。',
        tags: ['summon'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'spirit_resonance_buff' }],
            },
        ],
    },
    {
        id: 'sword_dominion',
        name: '御剑诀',
        description: '以炁御剑，剑随意动。延长攻击距离。',
        tags: ['imperial', 'qi', 'range_up'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'sword_dominion' }],
            },
        ],
    },
    {
        id: 'last_sword',
        name: '绝剑诀',
        description: '绝境之剑，伤势越重，剑意越强。',
        tags: ['qi', 'low_hp'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'last_stand' }],
            },
        ],
    },
    {
        id: 'iaijutsu_mastery',
        name: '居合道',
        description: '居合拔刀术的极致境界。习得居合斩与纳刀。',
        tags: ['stance'],
        grantsActions: ['_iaijutsu_strike', '_resheath', '_iaijutsu_ready'],
        // 开局「居合准备」：附着 buff 物化时（onActivate）跑一次触发招式，与旧的 battle_start 槽等价。
        // `_iaijutsu_ready` 也要留在招式缓存里（触发器招式以前靠触发槽引用进缓存，现在靠 grantsActions），
        // 否则触发入口的 `inst.canUse()` 次数判定拿不到实例。
        effects: [
            // 开局「居合准备」：附着 buff 物化时（onActivate）跑一次触发招式，与旧的 battle_start 槽等价。
            // `_iaijutsu_ready` 也要留在招式缓存里（触发器招式以前靠触发槽引用进缓存，现在靠 grantsActions），
            // 否则触发入口的 `inst.canUse()` 次数判定拿不到实例。
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'iaijutsu_ready_buff' }],
            },
        ],
    },
    {
        id: 'yi_dao_liu',
        name: '一刀流',
        description: '居合一刀，只此一斩。招架时顺势反击，斩出顺劈。',
        tags: ['counter', 'slash'],
        effects: [{ condition: { type: 'on_parry' }, actionId: 'light_slash' }],
    },
    {
        id: 'dragon_palace_style',
        name: '龙宫院流',
        description: '龙宫院秘传身法，招架或闪避后蓄势，叠加势。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_parry' },
                apply: [{ type: 'add_buff', buffId: 'shi_buff', stacks: 1 }],
            },
            {
                condition: { type: 'on_dodge' },
                apply: [{ type: 'add_buff', buffId: 'shi_buff', stacks: 1 }],
            },
        ],
    },
    {
        id: 'extreme',
        name: '极',
        description: '蓄势至极，一击必杀。缠劲满时获得极状态，下次≥5AP招式消耗所有缠劲，每层提升暴击率与暴击伤害。',
        tags: ['buff', 'chan'],
        effects: [
            {
                condition: {
                    type: 'chan_overflow',
                },
                apply: [{ type: 'add_buff', buffId: 'extreme' }],
            },
        ],
    },
    {
        id: 'zhou_liu_bu_xi',
        name: '周流不息',
        description: '周流不息，盈虚消长。缠劲满溢时自动凝聚。',
        tags: ['buff', 'qi', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'zhou_liu_bu_xi', stacks: 1 }],
            },
        ],
    },
    {
        id: 'human_radar',
        name: '人体雷达',
        description: '获得居合时锁定目标，下次近距离攻击命中提升。',
        tags: ['buff', 'stance'],
        requiredTags: ['stance'],
        effects: [
            {
                condition: { type: 'on_stance' },
                apply: [{ type: 'add_buff', buffId: 'circle' }],
            },
        ],
    },
    {
        id: 'ice_heart',
        name: '冰心诀',
        description: '冰心玉壶，免疫霜冻；对麻痹、灼烧、不幸、迷惑有50%几率免疫。',
        tags: ['defense', 'buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'elemental_immunity' }],
            },
        ],
    },
    {
        id: 'frost_mastery',
        name: '冰霜诀',
        description: '春雷疾掠，寒气侵骨。命中时概率叠加寒霜，暴击时剑意凝寒。',
        tags: ['debuff', 'frost'],
        effects: [
            {
                condition: { type: 'on_hit' },
                apply: [{ type: 'add_debuff', buffId: 'frost', stacks: 1, chance: 0.5 }],
            },
            {
                condition: { type: 'on_crit' },
                apply: [{ type: 'add_buff', buffId: 'chill_blade', stacks: 1 }],
            },
        ],
    },
    {
        id: 'nineteen_stops',
        name: '十九停',
        description: '每次出手叠一层「十九停」，层数越高越易失手。每层提升命中、暴击与暴伤，最多19层。',
        tags: ['buff', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'nineteen_stops', stacks: 1 }],
            },
        ],
    },

    {
        id: 'ordinary_training',
        name: '平平无奇的锻炼',
        description: '日复一日的刻苦锻炼，身法提升闪避，灵巧提升招架。',
        tags: ['defense', 'buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ordinary_training' }],
            },
        ],
    },
    {
        id: 'daily_grind',
        name: '日复一日的训练',
        description: '平平无奇的每日训练，洞察提升命中，推演提升闪避。',
        tags: ['defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'daily_grind' }],
            },
        ],
    },
    {
        id: 'momentum_mastery',
        name: '刃炁精通',
        requiredTags: ['slash'],
        description: '刃炁入体，每层受到伤害+5%。受到治疗时减少一层（累计10点治疗消一层）。',
        tags: ['debuff', 'slash'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'momentum_mastery_buff' }],
            },
        ],
    },
    {
        id: 'nei_xi_mian_chang',
        name: '炁蕴绵长',
        description: '内息悠长，增益久驻。每点推演使自身 buff 时长+5%。',
        tags: ['defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'nei_xi_mian_chang_duration' }],
            },
        ],
    },
    {
        id: 'overlord_art',
        name: '轮舞月斩',
        description: '长兵轮转，如月之轮舞。每一刀都顺势回旋突进。',
        tags: ['buff', 'polearm', 'heavy'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'overlord_art_buff' }],
            },
        ],
        grantsActions: ['retrieve_blade'],
        actionEnhancer: (def) => {
            if (!def.tags.includes('slash')) return def
            return { ...def, effects: [{ type: 'short_dash', maxDistance: 1 }, ...(def.effects ?? [])] }
        },
    },
    {
        id: 'yu_yang_shi_ba_shi',
        name: '渔阳十八势',
        description: '利用灵活的身法，寻找并感知对方。身法转化感知。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'yu_yang_shi_ba_shi_convert' }],
            },
        ],
    },
    {
        id: 'yi_dian_po_xiao',
        name: '一点破晓',
        description: '刺击以点破面，劲力透体。',
        tags: ['buff', 'pierce'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'yi_dian_po_xiao_buff' }],
            },
        ],
    },
    {
        id: 'inner_power',
        name: '归元劲',
        description: '内力深厚。每点推演提升力道，根骨，身法，灵巧。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'inner_power_convert' },
                    { type: 'add_buff', buffId: 'inner_power_cost' },
                ],
            },
        ],
    },
    {
        id: 'tai_chi_mastery',
        name: '太极',
        description: '太极圆满，以柔克刚。每点灵巧提升招架率与招架减伤。空手可招架。',
        tags: ['defense', 'buff', 'parry'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'tai_chi' }],
            },
        ],
    },
    {
        id: 'godspeed',
        name: '疾风迅雷',
        description: '神经电刺激，闪避后蓄势；被击中时雷闪反击。',
        tags: ['buff', 'electric'],
        effects: [
            { condition: { type: 'on_dodge' }, apply: [{ type: 'add_buff', buffId: 'thunder_swift', stacks: 1 }] },
            { condition: { type: 'on_was_hit' }, actionId: '_godspeed_counter' },
        ],
    },
    {
        id: 'thunder_art',
        name: '雷法',
        description: '雷电之力灌注全身，攻击附带雷击伤害，并概率麻痹对手。',
        tags: ['buff', 'electric', 'debuff', 'paralyze'],
        actionEnhancer: (def) => {
            if (!def.effects?.some((e) => e.type === 'damage')) return def
            if (!def.tags.includes('unarmed')) return def
            const chance = Math.min(0.8, def.apCost * 0.05)
            // 雷法灌注 → 该招式即雷系（electric tag，供虺雷牵等雷系判定生效）
            const tags: Tag[] = def.tags.includes('electric') ? def.tags : [...def.tags, 'electric']
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
                return { ...def, tags, effects: newEffects }
            }
            return {
                ...def,
                tags,
                effects: [...(def.effects ?? []), { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance }],
            }
        },
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'thunder_bonus' }],
            },
        ],
    },
    {
        id: 'zoldyck_art',
        name: '周氏秘法',
        description: '周氏秘法，雷电锻体，免疫麻痹并减免雷系伤害。',
        tags: ['buff', 'electric', 'inherent', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'paralyze_immunity' },
                    { type: 'add_buff', buffId: 'thunder_constitution' },
                ],
            },
        ],
    },
    {
        id: 'hui_lei_qian',
        name: '虺雷牵',
        description: '虺雷如活物，牵丝追踪，不死不休。所有雷系招式命中+8%。',
        tags: ['buff', 'electric'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'hui_lei_qian' }],
            },
        ],
    },
    {
        id: 'baihu_ding',
        name: '白虎定',
        description: '白虎定息，虎啸生风。闪避时回复缠劲。',
        tags: ['buff', 'defense', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'baihu_ding' }],
            },
        ],
    },
    {
        id: 'qiti_source',
        name: '炁体源流',
        description: '濒危时炁体护体吸收炁伤害，并将炁转化为力量、身法和灵巧。',
        tags: ['buff', 'qi', 'low_hp', 'cleanse', 'defense'],
        effects: [
            {
                condition: {
                    type: 'hp_below',
                    check: (ctx) => ctx.actor.hp / ctx.actor.maxHp < 0.2,
                },
                actionId: '_qiti_awaken',
            },
        ],
    },
    {
        // 因势利导：进架势后借势，下一击暴击（消费 on_stance，与转换时刻的护体互补）
        id: 'yin_shi_li_dao',
        name: '因势利导',
        description: '进架势时因势利导，下一次出招暴击率增加，暴击后消散。',
        tags: ['buff', 'stance'],
        requiredTags: ['stance'],
        effects: [
            {
                condition: { type: 'on_stance' },
                apply: [{ type: 'add_buff', buffId: 'yin_shi_li_dao', stacks: 1 }],
            },
        ],
    },
    {
        id: 'stance_time',
        name: '转换时刻',
        description: '进入架势时罡气护体，5秒内免疫眩晕、击退、打断、缴械、击倒，并减伤10%。',
        tags: ['buff', 'defense', 'super_armor'],
        requiredTags: ['stance'],
        effects: [
            {
                condition: { type: 'on_stance' },
                apply: [{ type: 'add_buff', buffId: 'stance_armor' }],
            },
        ],
    },
    {
        id: 'weapon_stance',
        name: '行云流水',
        description: '每次切换武器自动进入对应架势。',
        tags: ['buff', 'stance'],
        effects: [
            {
                // 「重器架势」覆盖 polearm 与 heavy：heavy = 重型武器（力道驱动），
                // 重剑/霸刀这类只有 heavy（不是 polearm）的兵器同样该进撼岳
                condition: {
                    type: 'on_weapon_change',
                    check: (ctx) => {
                        const w = ctx.actor.weaponDef ?? getWeapon(ctx.actor.build.weapon)
                        return w.tags.includes('polearm') || w.tags.includes('heavy')
                    },
                },
                apply: [
                    { type: 'remove_buff', buffId: 'melee_stance' },
                    { type: 'remove_buff', buffId: 'fist_stance' },
                    { type: 'add_buff', buffId: 'polearm_stance' },
                ],
            },
            {
                // 短兵架势只给「非重器」的 melee（重器已进撼岳，避免又被本条压回守拙）
                condition: {
                    type: 'on_weapon_change',
                    check: (ctx) => {
                        const w = ctx.actor.weaponDef ?? getWeapon(ctx.actor.build.weapon)
                        return w.tags.includes('melee') && !w.tags.includes('heavy')
                    },
                },
                apply: [
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
                apply: [
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
        description: '古墓中蒙眼抓雀练就的身法与感知。身法+2，灵巧+2，洞察降低效果减半。',
        tags: ['defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'dark_room_catch_attr' },
                    { type: 'add_buff', buffId: 'insight_guard' },
                ],
            },
        ],
    },
    {
        id: 'yue_nv_sword',
        name: '越女剑法',
        description: '白猿授剑，万兵为剑。出剑极快，身随剑走。',
        tags: [],
        // 目前short dash太op，暂时注释
        actionEnhancer: (def) => {
            if (!def.effects?.some((e) => e.type === 'damage')) return def
            return {
                ...def,
                effects: [{ type: 'short_dash', maxDistance: 1 }, ...(def.effects ?? [])],
            }
        },
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'yue_nv_buff' }],
            },
        ],
    },
    {
        // 不滞于物：万兵在手皆可为剑——所有伤害招式带 pierce 标记（供越女剑意全招生效），并按推演加伤
        id: 'bu_zhi_yu_wu',
        name: '不滞于物',
        description: '不滞于物，草木竹石皆可为剑。招式皆带刺击；命中时消耗1点缠劲附加伤害。',
        tags: ['buff'],
        actionEnhancer: (def) => {
            if (!def.effects?.some((e) => e.type === 'damage')) return def
            if (def.tags.includes('pierce')) return def
            return { ...def, tags: [...def.tags, 'pierce'] }
        },
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'bu_zhi_yu_wu' }],
            },
        ],
    },
    // ── 杨过 ──
    {
        id: 'one_arm',
        name: '独臂',
        description: '总有断臂之人不喜义体。无法双持。运劲更凝练，招式消耗降低1AP（最低1）。',
        tags: ['debuff', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'one_arm_buff' }],
            },
        ],
    },
    {
        id: 'dark_iron_sword_art',
        name: '玄剑秘册',
        description:
            '玄门流落在外的秘籍，虽无玄门血脉，亦可以炁御物。无法精巧御物，但可减少重器的身法负担，并以剑意施展手上功夫。',
        tags: ['buff', 'heavy', 'heavy_reduce'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'dark_iron_sword_art_tag' },
                    { type: 'add_buff', buffId: 'heavy_training' },
                ],
            },
        ],
    },
    {
        id: 'tide_inner_power',
        name: '潮汐炁功',
        description: '炁如潮汐般涨落，每回合交替以力道或身法驱动招式。可化解重器的身法负担（固定-2）。',
        tags: ['buff', 'qi', 'heavy_reduce'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'tide_power', stacks: 0 }],
            },
        ],
    },
    {
        id: 'shenxing_baibian',
        name: '神行百变',
        description: '铁剑门绝学，身法灵动百变，极难捉摸。',
        tags: ['defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'min_move_cost' },
                    { type: 'add_buff', buffId: 'shenxing_baibian_buff' },
                ],
            },
        ],
    },
    {
        id: 'xuannv_sword',
        name: '玄女剑法',
        description: '独臂神尼所创上乘剑法，以巧借力、以奇制胜，灵巧化为力道。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'xuannv_sword_convert' }],
            },
        ],
    },
    {
        id: 'zhu_huo_jue',
        name: '铸火诀',
        description: '聚炁化火，火中淬炼不伤。',
        tags: ['buff', 'qi', 'burn', 'defense'],
        requiredTags: ['burn'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'zhu_huo_jue_buff' }],
            },
        ],
    },
    {
        id: 'wan_xiang_jian_yi',
        name: '万象剑意',
        description: '以剑意模拟天地万象。自身每有1层增益buff（不含debuff与永久buff），暴击伤害+5%。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'wan_xiang_jian_yi_buff' }],
            },
        ],
    },
    {
        id: 'stone_skin',
        name: '石肤功',
        description: '肌肤如岩石般坚硬，所受直伤-10%，灼烧伤害减半。',
        tags: ['defense', 'buff', 'burn'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'stone_skin' }],
            },
        ],
    },
    {
        id: 'qishier_bian',
        name: '七十二变',
        description: '地煞七十二变，夺天地之造化。每6秒轮流使力道、根骨、身法、灵巧、洞察、推演提升。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'qishier_bian', stacks: 0 }],
            },
        ],
    },
    {
        id: 'hua_gun',
        name: '舞花棍',
        description: '以灵巧驾驭长兵，棍花如屏。灵巧越高招架越强，距离≥4m时更强。',
        tags: ['defense', 'buff', 'polearm'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'hua_gun_parry' }],
            },
        ],
    },
    {
        // 疯魔功：任何招式命中叠疯魔层（≤5），伤换伤；满层下一招必中+翻倍
        id: 'feng_mo_gong',
        name: '疯魔功',
        description: '不疯魔，不成活。不再消退，越战越疯。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'feng_mo_gong', stacks: 1 }],
            },
        ],
    },
    {
        id: 'frost_step',
        name: '踏雪',
        description: '踏雪如履平地，身法轻灵。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'frost_step_speed' }],
            },
        ],
    },
    {
        id: 'yuxin_sword_mastery',
        name: '真假无用心经',
        description: '真假无用，虚实可辨。所有可叠层 buff 上限翻倍，但每次叠层消耗缠劲。',
        tags: ['buff', 'chan'],
        requireAttrsMin: {},
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'yuxin_sword_mastery' }],
            },
        ],
    },
    {
        id: 'lingxi_finger',
        name: '灵犀一指',
        description: '空手入白刃，招架时缴械。',
        tags: ['buff', 'defense', 'unarmed', 'parry'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'lingxi_finger' }],
            },
        ],
    },
    {
        id: 'feng_wu_jiu_tian',
        name: '凤舞九天',
        description: '凤舞九天，翩若惊鸿，来去如风。',
        tags: ['move'],
        grantsActions: ['feng_hui', 'feng_fan'],
    },
    {
        id: 'beiming',
        name: '北冥神功',
        description: '北冥之渊，吞噬万物。命中时汲取敌方推演 1 点，持续 5 秒。',
        tags: ['buff', 'qi', 'debuff'],
        effects: [
            {
                condition: { type: 'on_hit' },
                apply: [{ type: 'stat_transfer', stat: 'wisdom', value: 1, duration: 5000 }],
            },
        ],
    },
    {
        id: 'golden_light',
        name: '金光咒',
        description: '金光护体，AP上限-1。',
        tags: ['buff', 'defense', 'qi'],
        // 占内息上限的载体排在最前：物化顺序与旧的 battle_start 槽同一时刻
        effects: [
            // 占内息上限的载体排在最前：物化顺序与旧的 battle_start 槽同一时刻
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'golden_light_ap' },
                    { type: 'add_buff', buffId: 'golden_light' },
                ],
            },
        ],
    },
    {
        id: 'sword_intent_tempering',
        name: '剑意淬体',
        description: '剑意淬炼肉身，减免 slash/pierce 伤害，且单次受伤不超过最大生命的一定比例。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'sword_intent_tempering' }],
            },
        ],
    },
    {
        id: 'yu_du_shu',
        name: '毒炁外泄',
        description: '毒雾护体，周期性释放毒素。血量越少，毒雾越烈。',
        tags: ['buff', 'poison', 'low_hp'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'yu_du_shu' }],
            },
        ],
    },
    {
        id: 'yi_ma_xin_yuan',
        name: '意马心猿',
        description: '心猿意马，劲力扰神。凝神聚气提升命中，命中时令对手心神被扰。',
        tags: ['debuff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'yi_ma_xin_yuan' }],
            },
        ],
    },
    {
        id: 'tongtian',
        name: '通天录',
        description: '悟生离死别。攻击命中时有概率令对手不幸缠身。',
        tags: ['debuff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'tongtian' }],
            },
        ],
    },
    {
        id: 'no_parry_style',
        name: '流风回雪',
        description: '飘飖兮若流风之回雪。不招架，只闪避，将招架率转化为闪避率。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'no_parry_buff' }],
            },
        ],
    },
    {
        id: 'yun_long_san_xian',
        name: '云龙三现',
        description:
            '云龙三现。龙游云中，见首不见尾。交替使用不同斩击招式可叠加增伤（至多3层），重复同一招不归零、只是不再叠加。每层附加身法+灵巧伤害。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'draw_sword_combo_buff' }],
            },
        ],
    },
    {
        id: 'dan_dao_fa_xuan',
        name: '单刀法选',
        description: '单刀法选，诱而击之，惊而取之。闪避后下一击暴击率增加，不可叠加。',
        tags: ['buff'],
        effects: [{ condition: { type: 'on_dodge' }, apply: [{ type: 'add_buff', buffId: 'jing_ji' }] }],
    },
    {
        // 太上御法（玄门祖传）：召唤物命中时微量回血
        id: 'tai_shang_yu_fa',
        name: '太上御法',
        requiredTags: ['imperial'],
        description: '玄门祖传御法。御物命中时，回炁养身，回复1点气血。',
        tags: ['qi', 'heal'],
        effects: [{ condition: { type: 'on_summon_hit' }, actionId: '_tai_shang_heal' }],
    },
    // ── 白驹过隙（由「匆匆一瞥」拆分而来：身法→爆伤，3米内） ──
    {
        id: 'bai_ju_guo_xi',
        name: '白驹过隙',
        description: '白驹过隙，匆匆一瞥，距对手3米内，每点身法提升暴击伤害。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'bai_ju_guo_xi_buff' }],
            },
        ],
    },
    // ── 抽刀断水（暴击破气：打断对方 AP 与回复，纯扣不给缠） ──
    {
        id: 'chou_dao_duan_shui',
        name: '抽刀断水',
        description: '抽刀断水。刀落，水断。暴击时对方气息一滞。',
        tags: ['debuff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'chou_dao_duan_shui_buff' }],
            },
        ],
    },
    {
        id: 'jing_luo_chu_jian',
        name: '经络初鉴',
        description: '熟稔经络，洞察弱点。每点洞察增加1%暴击率。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'jing_luo_chu_jian' }],
            },
        ],
    },
    {
        id: 'dian_xue_passive',
        name: '灵枢真解',
        description: '灵枢真解，点穴封脉。',
        tags: ['debuff', 'paralyze'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ling_xu_zhen_jie' }],
            },
        ],
    },
    {
        id: 'li_wu_xu_fa',
        name: '例无虚发',
        description: '所有暗器招式命中率+50%。',
        tags: ['buff', 'thrown'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'li_wu_xu_fa' }],
            },
        ],
    },
    // ── 酒鬼·无志 ──
    {
        id: 'zui_quan',
        name: '醉拳',
        description: '醉态蹒跚，步法诡谲。徒手招式附带短距冲刺，身法化闪避；有酒劲buff时闪避额外增加。',
        tags: ['buff', 'jiu', 'unarmed'],
        actionEnhancer: (def) => {
            if (!def.tags?.includes('unarmed') || !def.effects?.some((e) => e.type === 'damage')) return def
            return { ...def, effects: [{ type: 'short_dash', maxDistance: 1 }, ...def.effects] }
        },
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'zui_quan_dodge' }],
            },
        ],
    },
    {
        id: 'jiu_yang_shen_gong',
        name: '九阳神功',
        description: '九阳真气护体，提升AP恢复速度。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'nei_xi_peng_pai', stacks: 2.5 }],
            },
        ],
    },
    {
        id: 'hun_yuan_gong',
        name: '混元功',
        description:
            '混元护体，受到超过8点或炁伤害时护体：近身反伤三分之一并击退对手，远程以缠抵伤（耗缠为伤害三分之一，减伤三分之一）。',
        tags: ['qi', 'defense', 'chan', 'counter', 'knockback'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'hun_yuan_gong_buff' }],
            },
        ],
    },
    {
        id: 'qian_kun_da_nuo_yi',
        name: '醉里乾坤',
        description: '醉态中，体内炁流波动，受击时有概率反弹伤害。醉酒越深，反弹越高。',
        tags: ['defense', 'jiu', 'chan', 'counter'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'qian_kun_fan_tan' }],
            },
        ],
    },
    {
        id: 'sword_focus',
        name: '怒炁充盈',
        description: '攻击落空时积攒怒气，暴击时倾泻而出：每层爆伤+30%，暴击后怒气清空。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'sword_focus' }],
            },
        ],
    },
    {
        id: 'drunken_step',
        name: '醉仙望月步',
        description: '醉态越深，身法越飘忽。每层醉酒获得6%闪避。',
        tags: ['defense', 'buff', 'jiu'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'drunken_step' }],
            },
        ],
    },
    {
        id: 'ningqi_jue',
        name: '凝炁诀',
        description: '药屋家传呼吸法，血脉限定的炼炁诀。以炁劲贯通全身，所有招式带炁。外人无法修习。',
        tags: ['qi', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ningqi_jue_attr' }],
            },
        ],
        actionEnhancer: (def) => {
            if (def.tags?.includes('qi')) return def
            return { ...def, tags: [...(def.tags ?? []), 'qi'] }
        },
    },
    {
        // 锐炁诀：与凝炁诀联动（全招带炁 → 全招 30% 穿透）
        id: 'rui_qi_jue',
        name: '锐炁诀',
        description: '炁凝如锋，锐不可当。所有带炁的招式，部分伤害转为穿透。',
        tags: ['buff', 'qi'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'rui_qi_jue' }],
            },
        ],
    },
    {
        id: 'sword_capture',
        name: '无刀取',
        description: '空手入白刃。获得1个额外触发槽，空手可招架，招架成功后有概率缴械对手。',
        tags: ['buff', 'defense', 'debuff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'sword_capture_slot' },
                    { type: 'add_buff', buffId: 'sword_capture' },
                ],
            },
        ],
    },
    {
        id: 'ru_yi_jin',
        name: '如意劲',
        description: '暴击时消耗3层缠劲，按灵巧增加暴击伤害。',
        tags: ['buff', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ru_yi_jin' }],
            },
        ],
    },
    {
        id: 'blood_rage',
        name: '困兽犹斗',
        description: '气血越低属性加成越高。力道、身法、灵巧随血量减少而提升。',
        tags: ['buff', 'low_hp'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'blood_rage' }],
            },
        ],
    },
    {
        id: 'gear_shift',
        name: '挂挡',
        description: '凝缠劲为内息，运转不息。习得招式「挂」。',
        tags: ['buff', 'chan'],
        grantsActions: ['gear_hang'],
    },
    {
        // 神照经：血越少 AP 回复越快（额外回复，封顶 0.5/秒）
        id: 'shen_zhao_jing',
        name: '神照经',
        description: '神照通明，气血愈衰，气机愈盛。气血越低，AP回复越快，最多+0.5/秒。',
        tags: ['buff', 'low_hp'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'shen_zhao_jing' }],
            },
        ],
    },
    {
        id: 'karate',
        name: '空手道',
        description: '空手道不打蛮力，讲究拳到脚到、蹬地转腰，把劲凝在最刁钻的打击点上。空手拳脚伤害+10%，招式AP-0.5。',
        tags: ['buff', 'unarmed'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'karate' }],
            },
        ],
    },
    {
        id: 'fei_hua_shou',
        name: '漫天花雨',
        description: '暗器出手如飞花，可连续追加投掷攻击。暗器招式AP消耗减少。',
        tags: ['buff', 'thrown'],
        requireAttrsMin: { dexterity: 16 },
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'fei_hua_shou' }],
            },
        ],
    },
    {
        id: 'lian_da_mi_jue',
        name: '练打秘诀',
        description: '暗器出手附灵巧加成：灵巧×0.1；消耗1缠劲则提升至灵巧×0.2。',
        tags: ['buff', 'chan', 'thrown'],
        requireAttrsMin: { dexterity: 16 },
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'lian_da_mi_jue' }],
            },
        ],
    },
    // ── 毒药大师（唐柔·唐门制毒） ──
    {
        id: 'du_yao_da_shi',
        name: '毒药大师',
        description: '唐门制毒世家，以巧手施毒。施毒暴击时，每6点灵巧多叠1层毒。',
        tags: ['inherent', 'poison'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'du_yao_da_shi' }],
            },
        ],
    },
    {
        id: 'sekai_heroism',
        name: '舍得心法',
        description: '舍得心法，有舍有得。以根骨换取极致的速度与感知。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'sekai_heroism_attr' }],
            },
        ],
    },
    {
        id: 'combat_instinct',
        name: '本能特训',
        description: '经过特训，将战斗本能化为直觉反应。每5点洞察增加1触发槽。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'combat_instinct_slot' }],
            },
        ],
    },
    {
        id: 'insight_awareness',
        name: '先觉功',
        description: '先觉者，未战而先胜。以洞察预判对手攻势，洞察越高招架率与闪避率越高。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'insight_awareness' }],
            },
        ],
    },
    {
        id: 'wolf_hunting',
        name: '苍狼劲',
        description: '取苍狼猎杀之势，借体重、惯性与旋力增伤。消耗缠劲，附加额外伤害。',
        tags: ['buff', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'wolf_hunting_buff' }],
            },
        ],
    },
    {
        id: 'no_way_win',
        name: '无招胜有招',
        description: '无招胜有招，出手无定式。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'no_way_win_buff' }],
            },
        ],
    },
    {
        id: 'ling_long_xin_qiao',
        name: '玲珑心窍',
        description: '心窍玲珑，算尽对手每寸动作。每点推演增加1%暴击率。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ling_long_xin_qiao_buff' }],
            },
        ],
    },
    {
        id: 'autumn_water',
        name: '秋水论',
        description: '秋水时至，盈虚消长。灵巧与洞察之间随时间切换，如潮汐涨落；移动效率提高。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'autumn_water_tide', stacks: 0 }],
            },
        ],
    },
    {
        id: 'bu_dong_ming_wang',
        name: '不动明王',
        description: '不动如山，明王御守。招架时消耗缠劲，固定减免伤害。',
        tags: ['defense', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'bu_dong_ming_wang_buff' }],
            },
        ],
    },
    {
        id: 'ni_zhuan_jing_mai',
        name: '移经易脉',
        description: '逆转经脉运行，概率抵抗麻痹，降低被暴击伤害，被暴击时反击。',
        tags: ['defense', 'counter'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ni_zhuan_jing_mai' }],
            },
            { condition: { type: 'on_was_crit' }, actionId: '_generic_counter' },
        ],
    },
    {
        id: 'ling_ao_bu',
        name: '灵鳌步',
        description: '灵鳌踏浪，借势而进。闪避后冲向对手，撞出钝击并麻痹。',
        tags: ['unarmed', 'debuff', 'paralyze'],
        effects: [{ condition: { type: 'on_dodge' }, actionId: '_ling_ao_chong' }],
    },
    {
        id: 'luo_ying_shen_jian',
        name: '落英神剑',
        description: '部分伤害寄存于神剑印内，暴击时引爆造成双倍伤害。',
        tags: ['buff', 'qi'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'luo_ying_shen_jian_buff' }],
            },
        ],
    },
    {
        id: 'enhanced_vision',
        name: '超强感知',
        description: '将注意力锻炼至极致。洞察+4，招架时以敏锐感知进一步化解伤害。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'enhanced_vision_buff' }],
            },
        ],
    },
    // ── 炁电转换（天工·千星） ──
    {
        id: 'qi_electric_conversion',
        name: '炁电转换',
        description: '以炁驱动装备，身上的天工造物与义体越多、推演越高，力道、身法、灵巧提升越多。',
        tags: ['buff', 'craft'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'qi_electric_buff' }],
            },
        ],
    },
    // ── 千锤百炼（天工·千星·特性） ──
    {
        id: 'qian_chui_bai_lian',
        name: '千锤百炼',
        description: '千锤百炼，水火不侵。所受灼烧伤害-30%；以根骨化力道（根骨每4点力道+1）。',
        tags: ['buff', 'defense', 'inherent'],
        // 根骨化力道：构造期一次性转化（attr_convert 快照，floor 与「每4点+1」同源）
        effects: [
            // 根骨化力道：构造期一次性转化（attr_convert 快照，floor 与「每4点+1」同源）
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'qian_chui_bai_lian_convert' },
                    { type: 'add_buff', buffId: 'qian_chui_bai_lian_buff' },
                ],
            },
        ],
    },
    // ── 无明之明 ──
    {
        id: 'no_light_wisdom',
        name: '无明之明',
        description: '完全失去视觉，重新构建感知体系。推演也影响命中、闪避、招架与暴击。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'no_light_buff' }],
            },
        ],
    },
    {
        id: 'ru_shen_zuo_zhao',
        name: '入神坐照',
        description: '神意澄明。累计消耗AP，分四档提升洞察；神照圆满后，洞察减益不能动摇心神。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'ru_shen_zuo_zhao_guard' },
                    { type: 'add_buff', buffId: 'shen_zhao' },
                ],
            },
        ],
    },
    // ── 听劲 ──
    {
        id: 'hearing_power',
        name: '听劲',
        description: '接触感知对手劲力流转，每次命中短暂提升洞察。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_hit' },
                apply: [{ type: 'add_buff', buffId: 'hearing_insight', stacks: 1 }],
            },
        ],
    },
    // ── 明镜止水 ──
    {
        id: 'mingjing_zhishui',
        name: '明镜止水',
        description: '心如明镜止水，神清目明。免疫迷惑，抵抗失心；心不散则炁不泄，招式AP与缠劲消耗各-15%。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'mingjing_zhishui_buff' }],
            },
        ],
    },
    // ── 残影步 ──
    {
        id: 'can_ying_bu',
        name: '残影步',
        description: '步法如残影，移动时留下虚影迷惑对手。移动效率提升，每次移动叠加闪避。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'can_ying_bu_speed' }],
            },
            { condition: { type: 'on_move_away' }, apply: [{ type: 'add_buff', buffId: 'xu_ying', stacks: 1 }] },
            { condition: { type: 'on_move_closer' }, apply: [{ type: 'add_buff', buffId: 'xu_ying', stacks: 1 }] },
        ],
    },
    // ── 八卦棍法（竹子） ──
    {
        id: 'ba_gua_gun_fa',
        name: '奇门八卦',
        description: '奇门八卦步法。每次移动叠一层八卦步，增加闪避和暴击率。',
        tags: ['buff'],
        effects: [
            { condition: { type: 'on_move_away' }, apply: [{ type: 'add_buff', buffId: 'ba_gua_bu', stacks: 1 }] },
            { condition: { type: 'on_move_closer' }, apply: [{ type: 'add_buff', buffId: 'ba_gua_bu', stacks: 1 }] },
        ],
    },
    // ── 姬然 ──
    {
        id: 'guan_zi_zai_yan',
        name: '回光返照',
        description: '心境通明，气血波动中窥见武道真意。气血越低，洞察、推演越高。',
        tags: ['buff', 'low_hp'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'guan_zi_zai_yan' }],
            },
        ],
    },
    // ── 禅子 · 禅修 ──
    {
        id: 'yi_jin_jing',
        name: '易筋经',
        description: '佛门易筋洗髓之法，根骨+2，推演+2。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'yi_jin_jing_attr' }],
            },
        ],
    },
    {
        id: 'chanzi_chan_regen',
        name: '玄武定',
        description: '玄武定息，龟息绵绵。缠劲生生不息。',
        tags: ['buff', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'chanzi_chan_regen' }],
            },
        ],
    },
    {
        id: 'chan_ding',
        name: '朱雀定',
        description: '朱雀定息，以火炼炁。受击回复缠劲。',
        tags: ['buff', 'defense', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'chan_ding_buff' }],
            },
        ],
    },
    {
        id: 'qing_long_ding',
        name: '青龙定',
        description: '青龙定息，龙吟贯耳。暴击时回复缠劲。',
        tags: ['buff', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'qing_long_ding_buff' }],
            },
        ],
    },
    // ── 禅心慧眼（禅子·推演化命中暴击） ──
    {
        id: 'chan_xin_hui_yan',
        name: '禅心慧眼',
        description: '禅心通明，慧眼洞悉破绽。以推演窥破对手招式轨迹，推演化为命中与暴击。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'chan_xin_hui_yan_buff' }],
            },
        ],
    },
    // ── 枯蝉神功（阿九·锁血） ──
    {
        id: 'ku_chan_shen_gong',
        name: '枯蝉神功',
        description: '枯蝉锁血。受到致死伤害时无效那一次伤害，耗尽自身缠劲；此后免疫一切持续伤害，且无法被治疗。',
        tags: ['buff', 'chan', 'low_hp', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ku_chan', stacks: 1 }],
            },
        ],
    },
]

import type { Artifact } from '../engine/entities/artifact'

/** 所有可获取物品：义体（带副作用） + 奇物（特殊效果） */
export const ARTIFACTS: Artifact[] = [
    // ── 义体（tag: implant） ──
    {
        id: 'titanium_arm',
        name: '钛合金臂',
        description: '重型钛合金义肢，力大无穷。可飞向对手自爆。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { strength: 3, dexterity: 3 } }],
        grantsActions: ['_arm_explosion'],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'overload', stacks: 1 }] }],
    },
    {
        id: 'hydraulic_leg',
        name: '液压腿',
        description: '液压驱动义腿，爆发力惊人。所有招式附带短距冲刺。',
        tags: ['implant', 'inherent'],
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'overload', stacks: 1 }] },
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'hydraulic_leg_speed' }],
            },
        ],
        actionEnhancer: (def) => {
            if (!def.effects?.some((e) => e.type === 'damage')) return def
            return { ...def, effects: [{ type: 'short_dash', maxDistance: 1 }, ...(def.effects ?? [])] }
        },
    },
    {
        id: 'mechanical_eye',
        name: '机械眼球',
        description: '精密光学义眼，洞察入微，免疫迷眼。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { insight: 4 } }],
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'dark_room_sense' }] },
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'ap_drain', stacks: 1 }] },
        ],
    },
    {
        id: 'muscle_boost',
        name: '肌肉强化针',
        description: '肌肉强化注射剂，代价是身体负担。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { strength: 4, agility: 4 } }],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'muscle_degradation', stacks: 1 }],
            },
        ],
    },
    {
        id: 'nano_metal_heart',
        name: '纳米金属心脏',
        description: '纳米金属构筑的仿生心脏，泵血能力远超原生器官。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { strength: 2, agility: 2, dexterity: 1 } }],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'ap_drain', stacks: 1 }] }],
    },
    {
        id: 'synthetic_lung',
        name: '合成肺叶',
        description: '纳米材料合成的仿生肺叶，替换病变肺组织，焕活根骨。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { vitality: 4 } }],
    },
    {
        id: 'neural_net',
        name: '人造神经网络',
        description: '仿生神经增强网，反应速度提升。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { agility: 1, dexterity: 4, insight: 1 } }],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'fumble_chance', stacks: 2 }],
            },
        ],
    },
    {
        id: 'combat_chip',
        name: '战斗芯片',
        description: '战术辅助芯片，大幅提升推演。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { wisdom: 6 } }],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'fumble_chance', stacks: 1 }],
            },
        ],
    },
    {
        id: 'power_furnace',
        name: '便携式核动力炉',
        description: '微型核聚变动力炉，输出炁态能量供炼炁士使用，加速炁的恢复。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'permanent_burn', value: 2 }],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'max_ap_mod', value: 1 }],
            },
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'nei_xi_peng_pai', stacks: 2 }],
            },
        ],
    },
    {
        id: 'venom_gland',
        name: '毒腺',
        description: '每10秒消耗4层自身毒素，获得1点洞察，持续30秒。不满4层时不触发。',
        tags: ['implant', 'inherent', 'poison'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'venom_gland' }] }],
    },
    {
        id: 'marrow_pump',
        name: '髓泵',
        description: '植入脊椎的骨髓增强装置，持续刺激造血干细胞。最大气血+60，但装置耗能。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'max_hp_mod', value: 60 }],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'ap_drain', stacks: 1 }] }],
    },
    {
        id: 'cochlear_implant',
        name: '人造耳蜗',
        description: '听觉植入装置，集成翻译与通讯模块。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { insight: 4, wisdom: 1 } }],
    },
    // imperial
    {
        id: 'floating_eye',
        name: '浮游眼',
        description: '一枚以炁悬浮的异瞳，洞察流转，预判对手。洞察+4，暴击率+5%。',
        tags: ['buff', 'imperial'],
        effects: [{ type: 'add_buff', buffId: 'floating_eye_buff' }],
    },
    {
        id: 'flying_lion',
        name: '飞狮',
        description: '飞狮奇物，自动释放狮吼功。',
        tags: ['summon', 'imperial'],
        summon: {
            id: 'flying_lion',
            name: '飞狮',
            maxCount: () => 1,
            actionId: '_flying_lion_roar',
        },
    },
    {
        id: 'fen_shen_qiu',
        name: '分身球',
        description:
            '拔下毫毛化成的毛球，掷出后化作数个分身协战。分身以本体棍招出击，伤害仅为本体两成，命中暴击按自身属性结算，数量由根骨决定（最多3个）；每维持一个分身每秒消耗0.05点内息，并占用1点内息上限。',
        tags: ['summon'],
        summon: {
            id: 'fen_shen_qiu',
            name: '毫毛分身',
            maxCount: (self) => Math.max(1, Math.min(3, Math.ceil(self.attrs.get('vitality') / 5))),
            actionId: '_fen_shen_shot',
        },
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'max_ap_mod', value: -1 }] },
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'fen_shen_cost' }] },
        ],
    },
    {
        id: 'pu_ti_tou_huan',
        name: '菩提头环',
        description: '菩提枝编成的头环，澄澈心念。推演+4，50%免疫推演降低。',
        tags: ['buff', 'defense'],
        effects: [
            { type: 'stat_buff', attrs: { wisdom: 4 } },
            {
                type: 'stat_restriction',
                check: (_char, attr, _cur, delta) => {
                    if (attr === 'wisdom' && delta < 0 && Math.random() < 0.5) return { skip: true }
                    return null
                },
            },
        ],
    },
    {
        id: 'blood_thorn_ring',
        name: '血棘戒',
        description: '暴击时向创口渡入棘炁，引发持续流血。暴击的额外伤害转为流血层数。',
        tags: ['trigger', 'bleed'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'blood_thorn_suppress' }] },
        ],
    },
    {
        id: 'blood_thorn_earring',
        name: '血棘耳环',
        description: '血棘耳环见血封喉。持枪（刺）攻击暴击率+7%，对流血中目标再+8%。',
        tags: ['trigger', 'bleed', 'pierce'],
        requiredTags: ['pierce'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'blood_thorn_earring_buff' }],
            },
        ],
    },
    {
        id: 'wisdom_talisman',
        name: '通明符',
        description: '开悟通明，额外承载一道触发。',
        tags: ['trigger', 'buff'],
        effects: [
            { type: 'stat_buff', attrs: { insight: 2 } },
            { type: 'trigger_slot_mod', value: 1 },
        ],
    },
    {
        id: 'innate_seed',
        name: '天生道种',
        description: '先天道种，扎根武道。',
        tags: ['inherent'],
    },
    {
        id: 'tiger_eye',
        name: '虎彻之眼',
        description: '进入居合时双目如虎，洞察先机。',
        tags: ['trigger', 'buff'],
        triggers: [
            {
                condition: { type: 'on_stance' },
                actionId: '_tiger_eye_foresight',
            },
        ],
    },
    {
        id: 'calming_talisman',
        name: '定心香氛',
        description: '感知肾上腺素后散发镇定香氛，切换姿态时旧香换新，余香缭绕。洞察+2，推演+2。',
        tags: ['buff'],
        triggers: [
            {
                condition: { type: 'on_stance' },
                effects: [
                    { type: 'remove_buff', buffId: 'calming_fragrance' },
                    { type: 'add_buff', buffId: 'calming_aftertaste', stacks: 1 },
                    { type: 'add_buff', buffId: 'calming_fragrance' },
                ],
            },
        ],
    },
    {
        id: 'qi_guard',
        name: '吞炁囊',
        description: '开局凝聚炁盾，吸收炁招式伤害2点，共40次。',
        tags: ['trigger', 'defense', 'qi'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'qi_shield', stacks: 40 }] },
        ],
    },
    {
        id: 'iron_will',
        name: '乌铠',
        description: '受到超过5点的拳脚/斩/刺/钝伤害时，消耗1AP减少4点。',
        tags: ['trigger', 'defense', 'inherent'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'dmg_reduce' }] }],
    },
    {
        id: 'qi_amplifier',
        name: '凝炁玉',
        description: '天工锻造的炁能增幅器，增幅炁系武器的锋芒。',
        tags: ['trigger', 'buff', 'craft'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'qi_amplify' }] }],
    },
    {
        id: 'bamboo_hat',
        name: '青竹斗笠',
        description: '遮面掩踪，远程攻击（距离≥5）额外 +15% 闪避。',
        tags: ['defense'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'ranged_dodge' }] }],
    },
    {
        id: 'frost_silk_robe',
        name: '冰蚕衣',
        description: '冰蚕丝织就的软甲，遇寒愈坚。招架率+12%；招架后以寒气反噬对手。',
        tags: ['defense', 'inherent'],
        effects: [{ type: 'parry_mod', value: 0.12 }],
        triggers: [
            {
                condition: { type: 'on_parry' },
                effects: [{ type: 'add_debuff', buffId: 'frost', stacks: 1, chance: 1 }],
            },
        ],
    },
    {
        id: 'poison_coating',
        name: '淬毒工具',
        description: '刃上淬毒，割裂或刺击时概率令其中毒。',
        tags: ['poison', 'trigger'],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'poison_coating' }] }],
    },
    {
        id: 'shixiang_ruanjin_san',
        name: '十香软筋散',
        description: '无色无味之毒，中者筋骨酥软。每次中毒时叠加一层虚弱。',
        tags: ['poison', 'debuff', 'trigger'],
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'shixiang_ruanjin_san' }] },
        ],
    },
    {
        id: 'western_poison',
        name: '西域奇毒',
        description: '剧毒入体，麻痹神经。每次中毒时叠加一层麻痹。',
        tags: ['debuff', 'poison', 'trigger', 'paralyze'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'western_poison_buff' }] },
        ],
    },
    {
        id: 'other_mountain',
        name: '他山之石',
        description: '现代搏击技巧总汇。博采众长，洞察入微。',
        tags: ['buff'],
        effects: [{ type: 'stat_buff', attrs: { insight: 1, dexterity: 2, wisdom: 2 } }],
    },
    {
        id: 'cinnabar_mole',
        name: '守宫砂',
        description: '龙虎山秘传之印，每三击蓄满雷印，下一击爆发×1.5。',
        tags: ['trigger', 'inherent'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'cinnabar_mark' }] }],
    },
    {
        id: 'golden_silk_gloves',
        name: '金丝手套',
        description: '天工锻造的金丝手套，空手亦可格挡兵刃。招架率+15%，空手可招架。',
        tags: ['defense', 'craft'],
        effects: [{ type: 'parry_mod', value: 0.15 }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'silk_guard' }] }],
    },
    {
        id: 'herb_pouch',
        name: '蜂草鱼囊',
        description: '玉蜂浆、断肠草、寒潭白鱼所制，每 5 秒自动化解一层毒素，且恢复2点气血',
        tags: ['trigger', 'heal'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'herb_pouch' }] }],
    },
    {
        id: 'snake_gall',
        name: '蛇胆',
        description: '普斯曲蛇的蛇胆，强筋健骨。力道+2，根骨+2，毒抗+70%。',
        tags: ['buff', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { strength: 2, vitality: 2 } }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'poison_resist' }] }],
    },
    {
        id: 'fiery_eyes',
        name: '火眼金睛',
        description: '历经焚炼，目光如炬，洞察入微。洞察+5。',
        tags: ['buff', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { insight: 5 } }],
    },
    {
        id: 'soft_hedgehog_mail',
        name: '软猬甲',
        description: '天工锻造的软猬甲衣，柔韧而多刺。减免所有伤害；受拳脚攻击时反伤并令对手流血。',
        tags: ['defense', 'craft'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'soft_armor' }] }],
    },
    {
        id: 'golden_bell_rope',
        name: '金玲索',
        description: '金玲索，以炁御之，可攻可守。受到炁攻击时减伤2点；非炁攻击被招架时额外减免2点。',
        tags: ['defense'],
        grantsActions: ['_golden_bell_swing'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'golden_bell_guard' }] },
        ],
    },
    {
        id: 'gu_tong_body',
        name: '蛊童圣体',
        description: '从小被蛊毒炼就的毒体。拳掌互击时双方各半概率叠毒。',
        tags: ['inherent', 'poison'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'gu_tong_body' }] }],
    },
    {
        id: 'chan_orb',
        name: '凝缠珠',
        description: '禅意内敛，气机沉凝。持有者每2秒恢复3点缠劲。',
        tags: ['buff'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'chan_orb_regen' }] }],
    },
    {
        id: 'jiu_yin_zhen_jing',
        name: '九阴真经',
        description: '古墓石壁遗刻，夜夜观读，字字入心。以洞察悟缠劲，每秒按洞察回复缠劲。',
        tags: ['buff', 'qi'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'jiu_yin_zhen_jing_buff' }] },
        ],
    },
    {
        id: 'blood_sacrifice_armband',
        name: '血祭护腕',
        description: '天工锻造的血祭护腕，每招消耗3%最大气血，化为额外伤害并缓慢恢复。',
        tags: ['buff', 'craft'],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'blood_sacrifice' }] }],
    },
    {
        id: 'wakizashi',
        name: '胁差',
        description: '腰间短刀，收拔自如。闪避或招架后可立即反击。',
        tags: ['weapon', 'counter'],
        triggers: [
            { condition: { type: 'on_parry' }, actionId: 'light_slash' },
            { condition: { type: 'on_dodge' }, actionId: 'light_slash' },
        ],
    },
    {
        id: 'iron_mask',
        name: '机巧面具',
        description: '天工锻造的黑铁面具，暗藏精密机巧，感知与推演皆大幅提升。',
        tags: ['buff', 'craft'],
        effects: [{ type: 'stat_buff', attrs: { insight: 3, wisdom: 2 } }],
    },
    {
        id: 'hui_xiang_dou',
        name: '茴香豆',
        description: '茴香豆，下酒良品。嚼几颗提神醒脑，全属性+1（除推演），持续10秒。',
        tags: ['buff'],
        grantsActions: ['_eat_beans'],
    },
    {
        id: 'nv_er_hong',
        name: '女儿红',
        description: '温润醇厚的黄酒，饮后气血奔涌。花1AP饮用，每秒回复1.5点气血，持续4秒，最多3层。',
        tags: ['jiu'],
        grantsActions: ['_jiu_nv_er_hong'],
    },
    {
        id: 'ba_wang_zui',
        name: '霸王醉',
        description: '烈酒入喉，缠劲熊熊。花1AP饮用，每层每秒回复1点缠劲，持续9秒，最多3层。',
        tags: ['jiu'],
        grantsActions: ['_jiu_ba_wang_zui'],
    },
    {
        id: 'zhu_ye_qing',
        name: '竹叶青',
        description: '翠竹清冽的药酒，饮后气血缓缓流转。花1AP饮用，每层每秒回复0.3%最大气血，持续9秒，最多3层。',
        tags: ['jiu'],
        grantsActions: ['_zhu_ye_qing'],
    },
    {
        id: 'shao_dao_zi',
        name: '烧刀子',
        description: '烈酒烧心，饮后暴击率大增。花1AP饮用，每层暴击率+9%，持续9秒，最多3层。',
        tags: ['jiu'],
        grantsActions: ['_shao_dao_zi'],
    },
    {
        id: 'bu_lao_quan',
        name: '不老泉',
        description: '养生琼浆，饮后内息奔涌。花1AP饮用，每层AP恢复+0.3/秒，持续9秒，最多3层。',
        tags: ['jiu'],
        grantsActions: ['_bu_lao_quan'],
    },
    {
        id: 'qing_nang_san_bao',
        name: '青囊三宝',
        description: '每7秒：有毒解毒，没毒止血。',
        tags: ['heal'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'qing_nang_san_juan' }] },
        ],
    },
    {
        id: 'pu_ti_zhu',
        name: '菩提珠串',
        description: '静心菩提念珠。推演+4，50%免疫临时失心。',
        tags: ['buff', 'defense'],
        effects: [{ type: 'stat_buff', attrs: { wisdom: 4 } }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'pu_ti_zhu_buff' }] }],
    },
    {
        id: 'combat_armor',
        name: '斗铠',
        description: '百战之铠，非炁伤害减免1点，但身法-2。',
        tags: ['defense', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { agility: -2 } }],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'combat_armor_def' }] },
        ],
    },
    {
        id: 'ju_chan_fa_yi',
        name: '聚缠法衣',
        description: '玄门法衣（御物），每5秒吸收整12的缠劲（余数保留），每12缠化为力道、身法、灵巧、推演+2，持续5秒。',
        tags: ['craft', 'buff', 'qi'],
        requiredTags: ['imperial'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'ju_chan_fa_yi' }] }],
    },
    {
        id: 'braid_blade',
        name: '发辫刃',
        description: '辫发中暗藏飞刃，敌人远离时自动追击。',
        tags: ['weapon', 'inherent'],
        grantsActions: ['_braid_blade'],
        triggers: [{ condition: { type: 'on_opponent_move_away' }, actionId: '_braid_blade' }],
    },
    // ── 战术腰包 ──
    {
        id: 'tactical_pouch',
        name: '战术腰包',
        description: '多功能战术腰包，内含战地包扎、解毒针、肾上腺素针。',
        tags: ['trigger', 'heal'],
        grantsActions: ['_field_dressing', '_detox_shot', '_adrenaline_shot'],
        triggers: [
            {
                condition: {
                    type: 'hp_below',
                    check: (ctx) => ctx.actor.hp / ctx.actor.maxHp < 0.7,
                },
                actionId: '_field_dressing',
            },
            {
                // 受害者侧事件：被施加毒且层数≥4 时自动解毒（on_debuff 带 buffId 过滤，区别于攻击方侧的 on_poison）
                condition: {
                    type: 'on_debuff',
                    buffId: 'poison',
                    check: (ctx) => {
                        const key = `poison::${ctx.actor.id}`
                        const layer = ctx.engine?.state.pendingBuffs.get(key)
                        return (layer?.restoreValue ?? 0) >= 4
                    },
                },
                actionId: '_detox_shot',
            },
            {
                condition: {
                    type: 'hp_below',
                    check: (ctx) => ctx.actor.hp / ctx.actor.maxHp < 0.5,
                },
                actionId: '_adrenaline_shot',
            },
        ],
    },
    {
        id: 'qi_xin_hai_tang',
        name: '七心海棠',
        description: '唐门至毒，所有施加的中毒伤害翻倍。',
        tags: ['poison', 'inherent'],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'qi_xin_hai_tang' }],
            },
        ],
    },
    {
        id: 'doctor_chip',
        name: '战斗芯片·改',
        description: '博士特制的战斗分析芯片，推演+4，回合开始时有概率叠加战斗数据。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { wisdom: 4 } }],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'fumble_chance', stacks: 1 }],
            },
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'combat_chip' }] },
        ],
    },
    {
        id: 'tempest',
        name: '暴雨梨花钉',
        description: '机簧发射二十七枚银钉，力道万钧，中者必死无救。从不淬毒。',
        tags: ['inherent'],
        grantsActions: ['tempest'],
    },
    // ── 天工锻造品 ──
    {
        id: 'tactical_goggles',
        name: '战术护目镜',
        description: '天工出品的多功能战术护目镜，集成分析仪与辅助瞄准系统，免疫迷眼。',
        tags: ['craft', 'buff'],
        effects: [{ type: 'stat_buff', attrs: { wisdom: 2, insight: 2 } }],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'dark_room_sense' }] }],
    },
    {
        id: 'nano_exoskeleton',
        name: '纳米外骨骼',
        description: '天工锻造的纳米外骨骼，增强力量与机动性。',
        tags: ['craft', 'buff'],
        effects: [{ type: 'stat_buff', attrs: { strength: 3, agility: 3 } }],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'ap_drain', stacks: 1 }] }],
    },
    {
        id: 'jet_drive',
        name: '喷气式机动装置',
        description: '天工锻造的喷气推进装置，大幅提升移动能力，免疫击倒。',
        tags: ['craft', 'buff'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'rocket_boost' }] },
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'jet_drive_speed' }],
            },
        ],
    },
    // ── 能量护盾 ──
    {
        id: 'energy_shield',
        name: '能量护盾',
        description: '天工锻造的能量护盾发生器，以缠化盾：直伤最多吸收三分之一（1缠:1伤，缠不足按比例吸收）。',
        tags: ['craft', 'defense'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'energy_shield_buff' }] },
        ],
    },
    // ── 蓄炁瓶 ──
    {
        id: 'qi_battery',
        name: '蓄炁瓶',
        description: '天工锻造的炁能储存装置，稳定释放炁能。',
        tags: ['craft', 'buff'],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'max_ap_mod', value: 1 }],
            },
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_buff', buffId: 'nei_xi_peng_pai', stacks: 1 }],
            },
        ],
    },
    // ── 忍者工具包 ──
    {
        id: 'ninja_tool_kit',
        name: '忍者工具包',
        description: '多功能忍者工具包。开局向对手泼油（整场灼烧伤害翻倍），内含撒菱与烟玉。',
        tags: ['craft', 'debuff'],
        grantsActions: ['_caltrops', '_smoke_bomb'],
        triggers: [
            {
                condition: { type: 'battle_start' },
                effects: [{ type: 'add_debuff', buffId: 'oil_coating', stacks: 1, chance: 1 }],
            },
        ],
    },
]

/** 按 ID 查找物品 */
export function getArtifact(id: string): Artifact | undefined {
    return ARTIFACTS.find((a) => a.id === id)
}

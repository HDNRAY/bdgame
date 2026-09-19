import type { Artifact } from '../engine/entities/artifact'

/** 所有可获取物品：义体（带副作用） + 奇物（特殊效果） */
export const ARTIFACTS: Artifact[] = [
    // ── 义体（tag: implant） ──
    {
        id: 'titanium_arm',
        name: '钛合金臂',
        description: '重型钛合金义肢，力大无穷。可飞向对手自爆。',
        tags: ['implant', 'inherent', 'burn'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'titanium_arm_attr' },
                    { type: 'add_buff', buffId: 'overload', stacks: 1 },
                ],
            },
        ],
        grantsActions: ['_arm_explosion'],
    },
    {
        id: 'hydraulic_leg',
        name: '液压腿',
        description: '液压驱动义腿，爆发力惊人。所有招式附带短距冲刺。',
        tags: ['implant', 'inherent'],
        actionEnhancer: (def) => {
            if (!def.effects?.some((e) => e.type === 'damage')) return def
            return { ...def, effects: [{ type: 'short_dash', maxDistance: 1 }, ...(def.effects ?? [])] }
        },
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'overload', stacks: 2 },
                    { type: 'add_buff', buffId: 'hydraulic_leg_speed' },
                ],
            },
        ],
    },
    {
        id: 'mechanical_eye',
        name: '机械眼球',
        description: '精密光学义眼，洞察入微，洞察降低效果减半。',
        tags: ['implant', 'inherent', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'mechanical_eye_attr' },
                    { type: 'add_buff', buffId: 'insight_guard' },
                    { type: 'add_buff', buffId: 'ap_drain', stacks: 1 },
                ],
            },
        ],
    },
    {
        id: 'muscle_boost',
        name: '肌肉强化针',
        description: '肌肉强化注射剂，代价是身体负担。',
        tags: ['implant', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'muscle_boost_attr' },
                    { type: 'add_buff', buffId: 'muscle_degradation', stacks: 1 },
                ],
            },
        ],
    },
    {
        id: 'nano_metal_heart',
        name: '纳米金属心脏',
        description: '纳米金属构筑的仿生心脏，泵血能力远超原生器官。',
        tags: ['implant', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'nano_metal_heart_attr' },
                    { type: 'add_buff', buffId: 'ap_drain', stacks: 1 },
                ],
            },
        ],
    },
    {
        id: 'synthetic_lung',
        name: '合成肺叶',
        description: '纳米材料合成的仿生肺叶，替换病变肺组织，焕活根骨。',
        tags: ['implant', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'synthetic_lung_attr' }],
            },
        ],
    },
    {
        id: 'neural_net',
        name: '人造神经网络',
        description: '仿生神经增强网，反应速度提升。',
        tags: ['implant', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'neural_net_attr' },
                    { type: 'add_buff', buffId: 'fumble_chance', stacks: 2 },
                ],
            },
        ],
    },
    {
        id: 'combat_chip',
        name: '战斗芯片',
        description: '战术辅助芯片，大幅提升推演。',
        tags: ['implant', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'combat_chip_attr' },
                    { type: 'add_buff', buffId: 'fumble_chance', stacks: 1 },
                ],
            },
        ],
    },
    {
        id: 'power_furnace',
        name: '便携式核动力炉',
        description: '微型核聚变动力炉，输出炁态能量供炼炁士使用，加速炁的恢复。',
        tags: ['implant', 'inherent', 'buff'],
        // 占内息上限的载体排在最前：物化顺序与旧的 battle_start 槽同一时刻（先改上限，再挂其他状态）
        effects: [
            // 占内息上限的载体排在最前：物化顺序与旧的 battle_start 槽同一时刻（先改上限，再挂其他状态）
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'power_furnace_ap' },
                    { type: 'add_buff', buffId: 'nei_xi_peng_pai', stacks: 3 },
                    { type: 'add_buff', buffId: 'permanent_burn', stacks: 1 },
                ],
            },
        ],
    },
    {
        id: 'venom_gland',
        name: '毒腺',
        description: '每10秒消耗3层自身毒素，获得1点洞察，持续30秒。不满3层时不触发。',
        tags: ['implant', 'inherent', 'poison', 'buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'venom_gland' }],
            },
        ],
    },
    {
        id: 'marrow_pump',
        name: '髓泵',
        description: '植入脊椎的骨髓增强装置，持续刺激造血干细胞。最大气血+60，但装置耗能。',
        tags: ['implant', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'marrow_pump_hp' },
                    { type: 'add_buff', buffId: 'ap_drain', stacks: 1 },
                ],
            },
        ],
    },
    {
        id: 'cochlear_implant',
        name: '人造耳蜗',
        description: '听觉植入装置，集成翻译与通讯模块。',
        tags: ['implant', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'cochlear_implant_attr' }],
            },
        ],
    },
    {
        id: 'doctor_chip',
        name: '战斗芯片·改',
        description: '博士特制的战斗分析芯片，推演+2，回合开始时有概率叠加战斗数据。',
        tags: ['implant', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'doctor_chip_attr' },
                    { type: 'add_buff', buffId: 'fumble_chance', stacks: 2 },
                    { type: 'add_buff', buffId: 'combat_chip' },
                ],
            },
        ],
    },
    // imperial
    {
        id: 'floating_eye',
        name: '浮游眼',
        description: '一枚以炁悬浮的异瞳，洞察流转，预判对手。',
        tags: ['imperial', 'summon', 'buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'floating_eye_buff' }],
            },
        ],
    },
    {
        id: 'flying_lion',
        name: '飞狮',
        description: '飞狮奇物，自动释放狮吼功。',
        tags: ['summon', 'imperial', 'stun'],
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
            '携带分身球，会生成分身。分身以力道灵巧出击（力量×0.15），命中暴击按自身属性结算，数量由体质决定（最多3个）；每秒消耗0.05点内息，并占用1点AP上限。',
        tags: ['summon'],
        summon: {
            id: 'fen_shen_qiu',
            name: '分身',
            maxCount: (self) => Math.max(1, Math.min(3, Math.ceil(self.attrs.get('vitality') / 5))),
            actionId: '_fen_shen_shot',
        },
        // 占内息上限的载体排在最前：物化顺序与旧的 battle_start 槽同一时刻
        effects: [
            // 占内息上限的载体排在最前：物化顺序与旧的 battle_start 槽同一时刻
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'fen_shen_qiu_ap' },
                    { type: 'add_buff', buffId: 'fen_shen_cost' },
                ],
            },
        ],
    },
    {
        id: 'pu_ti_tou_huan',
        name: '菩提头环',
        description: '菩提枝编成的头环，澄澈心念。推演+4，50%抵抗推演降低。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'pu_ti_tou_huan_attr' },
                    { type: 'add_buff', buffId: 'pu_ti_tou_huan_guard' },
                ],
            },
        ],
    },
    {
        id: 'blood_thorn_ring',
        name: '血棘戒',
        description: '暴击时向创口渡入棘炁，引发持续流血。暴击的额外伤害转为流血层数。',
        tags: ['bleed'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'blood_thorn_suppress' }],
            },
        ],
    },
    {
        id: 'blood_thorn_earring',
        name: '血棘耳环',
        description: '血棘耳环见血封喉。持枪（刺）攻击暴击率+7%，对流血中目标再+8%。',
        tags: ['bleed', 'pierce'],
        requiredTags: ['pierce'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'blood_thorn_earring_buff' }],
            },
        ],
    },
    {
        id: 'wisdom_talisman',
        name: '通明符',
        description: '开悟通明，额外承载一道触发。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'wisdom_talisman_attr' },
                    { type: 'add_buff', buffId: 'wisdom_talisman_slot' },
                ],
            },
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
        tags: ['buff', 'stance'],
        requiredTags: ['stance'],
        effects: [
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
        tags: ['buff', 'stance'],
        requiredTags: ['stance'],
        effects: [
            {
                condition: { type: 'on_stance' },
                apply: [
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
        description: '开局凝聚30层炁盾。',
        tags: ['defense', 'qi'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'qi_shield', stacks: 30 }],
            },
        ],
    },
    {
        id: 'iron_will',
        name: '乌铠',
        description: '受到超过4点的拳脚/斩/刺/钝伤害时，消耗1缠劲减免4点，每场最多20次。',
        tags: ['defense', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'dmg_reduce' }],
            },
        ],
    },
    {
        id: 'qi_amplifier',
        name: '凝炁玉',
        description: '天工锻造的炁能增幅器，增幅炁系武器的锋芒。',
        tags: ['buff', 'craft'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'qi_amplify' }],
            },
        ],
    },
    {
        id: 'bamboo_hat',
        name: '青竹斗笠',
        description: '遮面掩踪，远程攻击（距离≥4米）额外 +20% 闪避。',
        tags: ['defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ranged_dodge' }],
            },
        ],
    },
    {
        id: 'frost_silk_robe',
        name: '冰蚕衣',
        description: '冰蚕丝织就的软甲，遇寒愈坚。招架率+12%；招架近战攻击后以寒气反噬对手。',
        tags: ['defense', 'frost', 'counter'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'frost_silk_robe_buff' }],
            },
        ],
    },
    {
        id: 'poison_coating',
        name: '淬毒工具',
        description: '刃上淬毒，割裂或刺击时概率令其中毒。',
        tags: ['poison'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'poison_coating' }],
            },
        ],
    },
    {
        id: 'shixiang_ruanjin_san',
        name: '十香软筋散',
        description: '无色无味之毒，中者筋骨酥软。每次中毒时叠加一层虚弱。',
        tags: ['poison'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'shixiang_ruanjin_san' }],
            },
        ],
    },
    {
        id: 'western_poison',
        name: '西域奇毒',
        description: '剧毒入体，麻痹神经。每次中毒时叠加麻痹。',
        tags: ['poison', 'paralyze'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'western_poison_buff' }],
            },
        ],
    },
    {
        id: 'other_mountain',
        name: '他山之石',
        description: '现代搏击技巧总汇。博采众长，洞察入微。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'other_mountain_attr' }],
            },
        ],
    },
    {
        id: 'yao_xin_shi',
        name: '药心石',
        description: '药屋世代相传的护心石，危急时凝炁护心。',
        tags: ['craft', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'yao_xin_shi_buff' }],
            },
        ],
    },
    {
        id: 'cinnabar_mole',
        name: '守宫砂',
        description: '龙虎山秘传之印，每三击蓄满雷印，下一击爆发×1.5。',
        tags: ['inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'cinnabar_mark' }],
            },
        ],
    },
    {
        id: 'golden_silk_gloves',
        name: '金丝手套',
        description: '天工锻造的金丝手套，空手亦可格挡兵刃。',
        tags: ['defense', 'craft', 'parry'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'silk_guard' }],
            },
        ],
    },
    {
        id: 'herb_pouch',
        name: '蜂草鱼囊',
        description: '玉蜂浆、断肠草、寒潭白鱼所制，每 5 秒自动化解一层毒素，且恢复2点气血',
        tags: ['heal', 'cleanse'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'herb_pouch' }],
            },
        ],
    },
    {
        id: 'snake_gall',
        name: '菩斯曲蛇胆',
        description: '普斯曲蛇的蛇胆，强筋健骨。力道+2，根骨+2。',
        tags: ['buff', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'snake_gall_attr' }],
            },
        ],
    },
    {
        id: 'frog_gall',
        name: '莽牯朱蛤',
        description: '万毒之王，莽牯朱蛤，百毒不侵。灵巧+1，身法+1。',
        tags: ['buff', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'poison_resist' }],
            },
        ],
    },
    {
        id: 'fiery_eyes',
        name: '火眼金睛',
        description: '历经焚炼，目光如炬，洞察入微。洞察+5。',
        tags: ['buff', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'fiery_eyes_attr' }],
            },
        ],
    },
    {
        id: 'soft_hedgehog_mail',
        name: '软猬甲',
        description: '天工锻造的软猬甲衣，柔韧而多刺。受伤减免1点；受拳脚攻击时令对手流血。',
        tags: ['defense', 'craft', 'bleed', 'counter'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'soft_armor' }],
            },
        ],
    },
    {
        id: 'golden_bell_rope',
        name: '金玲索',
        description: '金玲索，以炁御之，可攻可守。',
        tags: ['defense', 'paralyze'],
        grantsActions: ['_golden_bell_swing'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'golden_bell_guard' }],
            },
        ],
    },
    {
        id: 'gu_tong_body',
        name: '蛊童圣体',
        description: '从小被蛊毒炼就的毒体。拳掌互击时双方各半概率叠毒。',
        tags: ['inherent', 'poison'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'gu_tong_body' }],
            },
        ],
    },
    {
        id: 'shi_gu',
        name: '蚀蛊',
        description: '毒入敌体自行繁衍蚀骨。你施加的中毒每跳有20%概率加深1层。',
        tags: ['inherent', 'poison'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'shi_gu_buff' }],
            },
        ],
    },
    {
        id: 'chan_orb',
        name: '凝缠珠',
        description: '禅意内敛，气机沉凝。持有者每秒恢复1点缠劲。',
        tags: ['buff', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'chan_orb_regen' }],
            },
        ],
    },
    {
        id: 'jiu_yin_zhen_jing',
        name: '九阴真经',
        description: '古墓石壁遗刻，夜夜观读，字字入心。以洞察悟缠劲，每秒按洞察回复缠劲。',
        tags: ['buff', 'chan'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'jiu_yin_zhen_jing_buff' }],
            },
        ],
    },
    {
        id: 'blood_sacrifice_armband',
        name: '血祭护腕',
        description: '天工锻造的血祭护腕，每招消耗气血化为等额额外伤害，并缓慢回复。',
        tags: ['buff', 'craft', 'low_hp'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'blood_sacrifice' }],
            },
        ],
    },
    {
        id: 'wakizashi',
        name: '胁差',
        description: '腰间短刀，收拔自如。闪避后可立即反击。',
        tags: ['weapon', 'counter'],
        effects: [{ condition: { type: 'on_dodge' }, actionId: 'pursuit_thrust' }],
    },
    {
        id: 'iron_mask',
        name: '机巧面具',
        description: '天工锻造的黑铁面具，暗藏精密机巧，感知与推演皆大幅提升。',
        tags: ['buff', 'craft'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'iron_mask_attr' }],
            },
        ],
    },
    {
        id: 'hui_xiang_dou',
        name: '茴香豆',
        description: '茴香豆，下酒良品。嚼几颗提神醒脑，全属性+1，持续10秒。',
        tags: ['buff'],
        grantsActions: ['_eat_beans'],
    },
    {
        id: 'nv_er_hong',
        name: '女儿红',
        description: '温润醇厚的黄酒，饮后气血奔涌。花1AP饮用，每秒回复1.5点气血，持续9秒，最多3层。',
        tags: ['jiu', 'heal'],
        grantsActions: ['_jiu_nv_er_hong'],
    },
    {
        id: 'ba_wang_zui',
        name: '霸王醉',
        description: '烈酒入喉，缠劲熊熊。花1AP饮用，每层每秒回复1点缠劲，持续9秒，最多3层。',
        tags: ['jiu', 'chan'],
        grantsActions: ['_jiu_ba_wang_zui'],
    },
    {
        id: 'zhu_ye_qing',
        name: '竹叶青',
        description: '翠竹清冽的药酒，饮后内息奔涌。花1AP饮用，每层AP恢复+0.3/秒，持续9秒，最多3层。',
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
        description: '养生琼浆，饮后气血缓缓流转。花1AP饮用，每3秒回复3点气血，持续9秒，最多3层。',
        tags: ['jiu', 'heal'],
        grantsActions: ['_bu_lao_quan'],
    },
    {
        id: 'qing_nang_san_bao',
        name: '青囊三宝',
        description: '每7秒：有毒解毒，没毒止血。',
        tags: ['heal', 'cleanse'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'qing_nang_san_juan' }],
            },
        ],
    },
    {
        id: 'pu_ti_zhu',
        name: '菩提珠串',
        description: '静心菩提念珠。推演+3，50%免疫临时失心。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'pu_ti_zhu_buff' }],
            },
        ],
    },
    {
        id: 'bai_na_zhu',
        name: '百纳珠',
        description: '百家愿力凝成的念珠，心定则刀兵不伤。被暴击伤害降低30%。',
        tags: ['defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'bai_na_zhu_buff' }],
            },
        ],
    },
    {
        id: 'combat_armor',
        name: '斗铠',
        description: '百战之铠，非炁伤害减免，但身法-2。',
        tags: ['defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'combat_armor_def' }],
            },
        ],
    },
    {
        id: 'ju_chan_fa_yi',
        name: '聚缠法衣',
        description: '玄门法衣，吸收缠劲，增加施法者属性。',
        tags: ['craft', 'buff', 'chan'],
        requiredTags: ['imperial'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ju_chan_fa_yi' }],
            },
        ],
    },
    {
        id: 'braid_blade',
        name: '发辫刃',
        description: '辫发中暗藏飞刃，敌人远离时自动追击。',
        tags: ['weapon', 'inherent', 'slash', 'pierce'],
        grantsActions: ['_braid_blade'],
        effects: [{ condition: { type: 'on_opponent_move_away' }, actionId: '_braid_blade' }],
    },
    // ── 战术腰包 ──
    {
        id: 'tactical_pouch',
        name: '战术腰包',
        description: '多功能战术腰包，内含止血针、解毒针、肾上腺素针。',
        tags: ['heal', 'cleanse'],
        grantsActions: ['_field_dressing', '_detox_shot', '_adrenaline_shot'],
        effects: [
            {
                condition: {
                    type: 'on_debuff',
                    buffId: 'bleed',
                    check: (ctx) => {
                        const key = `bleed::${ctx.actor.id}`
                        const layer = ctx.engine?.state.pendingBuffs.get(key)
                        return (layer?.restoreValue ?? 0) >= 4
                    },
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
        requiredTags: ['poison'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'qi_xin_hai_tang' }],
            },
        ],
    },
    {
        id: 'tempest',
        name: '暴雨梨花钉',
        description: '机簧发射二十七枚银钉，力道万钧，中者必死无救。从不淬毒。',
        tags: ['thrown', 'pierce', 'range', 'chan'],
        grantsActions: ['tempest'],
    },
    // ── 天工锻造品 ──
    {
        id: 'tactical_goggles',
        name: '战术护目镜',
        description: '天工出品的多功能战术护目镜，集成分析仪与辅助瞄准系统，洞察降低效果减半。',
        tags: ['craft', 'buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'tactical_goggles_attr' },
                    { type: 'add_buff', buffId: 'insight_guard' },
                ],
            },
        ],
    },
    {
        id: 'nano_exoskeleton',
        name: '纳米外骨骼',
        description: '天工锻造的纳米外骨骼，增强力量与机动性。',
        tags: ['craft', 'buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'nano_exoskeleton_attr' },
                    { type: 'add_buff', buffId: 'energy_drain', stacks: 1 },
                ],
            },
        ],
    },
    {
        id: 'jet_drive',
        name: '喷气式机动装置',
        description: '天工锻造的喷气推进装置，大幅提升移动能力，免疫击倒。',
        tags: ['craft', 'buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [
                    { type: 'add_buff', buffId: 'rocket_boost' },
                    { type: 'add_buff', buffId: 'jet_drive_speed' },
                ],
            },
        ],
    },
    // ── 能量护盾 ──
    {
        id: 'energy_shield',
        name: '能量护盾',
        description: '天工锻造的能量护盾发生器，以缠化盾：直伤最多吸收三分之一（1缠:1伤，缠不足按比例吸收）。',
        tags: ['craft', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'energy_shield_buff' }],
            },
        ],
    },
    // ── 蓄炁瓶 ──
    {
        id: 'qi_battery',
        name: '蓄炁瓶',
        description: '天工锻造的炁能储存装置，稳定释放炁能。',
        tags: ['craft', 'buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'nei_xi_peng_pai', stacks: 1 }],
            },
        ],
    },
    // ── 磁暴线圈 ──
    {
        id: 'ci_magnetic_coil',
        name: '磁暴线圈',
        description: '天工锻造的电磁增幅线圈，缠绕兵刃。电系招式伤害+15%，施加的麻痹层数翻倍。',
        tags: ['craft', 'electric', 'buff', 'paralyze'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'ci_magnetic_coil_buff' }],
            },
        ],
    },
    // ── 忍者工具包 ──
    {
        id: 'ninja_tool_kit',
        name: '忍者工具包',
        description: '忍者随身油囊，泼油浸敌，令其易受火攻。',
        tags: ['craft', 'burn'],
        grantsActions: ['_oil_splash'],
    },
    // ── 悬浮座椅（博士·义体） ──
    {
        id: 'wheelchair_lightness',
        name: '悬浮座椅',
        description: '悬浮座椅，以炁驱动。',
        tags: ['implant', 'inherent', 'buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'wheelchair_speed' }],
            },
        ],
    },
    // ── 人造发生器（博士·音波攻击） ──
    {
        id: 'sonic_generator',
        name: '人造发声器',
        description: '义体研究部特制音波发声器，释放高频音波直摄心魄。',
        tags: ['implant', 'inherent', 'debuff'],
        grantsActions: ['_sonic_wave'],
    },
    // ── 钛合金脊椎（隐藏boss 专属：只给「斗炁协会副会长」的旧义体，玩家不可获得） ──
    {
        id: 'titanium_spine',
        name: '钛合金脊椎',
        description: '整条脊椎换成钛合金，撑得住百年。根骨+5。',
        tags: ['implant', 'inherent'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'titanium_spine_attr' }],
            },
        ],
    },
    // ── 武学宝典总纲（通晓天下武学，闪/招→叠暴击；暴击→叠闪/招） ──
    {
        id: 'wuxue_baodian_zonggang',
        name: '武学宝典总纲',
        description: '通晓天下武学，以推演预判对手。闪/招→叠暴击；暴击→叠闪/招。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'wuxue_baodian_zonggang' }],
            },
        ],
    },
    // ── 武学宝典上（攻：奖励标签越多伤害越高） ──
    {
        id: 'wuxue_baodian_shang',
        name: '武学宝典上',
        description: '通晓天下武学路数。每有1个奖励标签，伤害+1%，上限15%。',
        tags: ['buff'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'wuxue_baodian_shang' }],
            },
        ],
    },
    // ── 武学宝典下（防：奖励标签越多受伤越少） ──
    {
        id: 'wuxue_baodian_xia',
        name: '武学宝典下',
        description: '通晓天下武学路数。每有1个奖励标签，受到伤害-1%，上限15%。',
        tags: ['buff', 'defense'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'wuxue_baodian_xia' }],
            },
        ],
    },
    // ── 自动净化背心 ──
    {
        id: 'auto_purify_vest',
        name: '自动净化背心',
        description: '秘制背心，感应自身异常状态，自行净化。',
        tags: ['defense', 'craft', 'cleanse'],
        effects: [
            {
                condition: { type: 'on_construct' },
                apply: [{ type: 'add_buff', buffId: 'auto_purify' }],
            },
        ],
    },
]

/** 按 ID 查找物品 */
export function getArtifact(id: string): Artifact | undefined {
    return ARTIFACTS.find((a) => a.id === id)
}

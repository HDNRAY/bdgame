import type { Artifact } from '../entities/artifact'

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
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'overload', stacks: 2 }] }],
    },
    {
        id: 'hydraulic_leg',
        name: '液压腿',
        description: '液压驱动义腿，爆发力惊人。所有招式附带短距冲刺。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'move_efficiency', value: 0.2 }],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'overload', stacks: 1 }] }],
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
        id: 'heart_pump',
        name: '心肺泵',
        description: '辅助循环系统，全面提升体能。',
        tags: ['implant', 'inherent'],
        effects: [{ type: 'stat_buff', attrs: { strength: 2, agility: 2, dexterity: 1 } }],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'ap_drain', stacks: 1 }] }],
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
        name: '便携式动力炉',
        description: '微型核聚变动力炉，能量永不枯竭。',
        tags: ['implant', 'inherent'],
        effects: [
            { type: 'max_ap_mod', value: 4 },
            { type: 'permanent_burn', value: 1 },
        ],
    },
    {
        id: 'floating_eye',
        name: '浮游眼',
        description: '一枚以炁悬浮的异瞳，洞察流转，预判对手。洞察+4，暴击率+10%。',
        tags: ['buff', 'imperial'],
        effects: [
            { type: 'stat_buff', attrs: { insight: 4 } },
            { type: 'crit_chance', value: 0.1 },
        ],
    },
    {
        id: 'flying_lion',
        name: '飞狮',
        description: '飞狮奇物，每约 10 秒自动释放一次狮吼功。',
        tags: ['summon'],
        summon: {
            id: 'flying_lion',
            name: '飞狮',
            maxCount: () => 1,
            actionId: '_flying_lion_roar',
        },
    },
    {
        id: 'blood_thorn_ring',
        name: '血棘戒',
        description: '暴击时在伤口注入血气，引发持续流血。',
        tags: ['trigger', 'bleed'],
        triggers: [{ condition: { type: 'on_crit' }, actionId: '_blood_thorn_bleed' }],
    },
    {
        id: 'wisdom_talisman',
        name: '通明符',
        description: '开悟通明，额外承载一道触发。',
        tags: ['trigger'],
        effects: [{ type: 'trigger_slot_mod', value: 1 }],
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
        triggers: [{ condition: { type: 'on_buff', buffId: 'iaijutsu' }, actionId: '_tiger_eye_foresight' }],
    },
    {
        id: 'qi_guard',
        name: '吞炁囊',
        description: '开局凝聚炁盾，吸收炁招式伤害2点，共99次。',
        tags: ['trigger', 'defense', 'qi'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'qi_shield', stacks: 99 }] },
        ],
    },
    {
        id: 'iron_will',
        name: '乌铠',
        description: '受到超过5点的斩/刺/钝伤害时，消耗1AP减少3点。',
        tags: ['trigger', 'defense'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'dmg_reduce' }] }],
    },
    {
        id: 'ap_boost',
        name: '气海丹',
        description: '拓展气海，AP上限+2。',
        tags: ['buff'],
        effects: [{ type: 'max_ap_mod', value: 2 }],
    },
    {
        id: 'qi_amplifier',
        name: '凝炁玉',
        description: '凝聚天地灵炁，增幅炁系武器的锋芒。',
        tags: ['trigger', 'buff'],
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
        description: '冰蚕丝织就的软甲，遇寒愈坚。招架率+15%；招架后以寒气反噬对手。',
        tags: ['defense'],
        effects: [{ type: 'parry_mod', value: 0.15 }],
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
        triggers: [
            {
                condition: { type: 'on_dealt_damage' },
                effects: [{ type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 0.3 }],
            },
        ],
    },
    {
        id: 'western_poison',
        name: '西域奇毒',
        description: '剧毒入体，麻痹神经。每次中毒时叠加一层麻痹。',
        tags: ['debuff', 'poison', 'trigger', 'paralyze'],
        triggers: [
            {
                condition: { type: 'on_poison' },
                effects: [{ type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 1 }],
            },
        ],
    },
    {
        id: 'other_mountain',
        name: '他山之石',
        description: '博采众长，洞察入微。宁毅所赠的现代搏击笔记。',
        tags: ['buff'],
        effects: [{ type: 'stat_buff', attrs: { insight: 4, dexterity: 1 } }],
    },
    {
        id: 'cinnabar_mole',
        name: '守宫砂',
        description: '龙虎山秘传之印，每三击蓄满雷印，下一击爆发×1.5。',
        tags: ['trigger', 'electric'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'cinnabar_mark' }] }],
    },
    {
        id: 'golden_silk_gloves',
        name: '金丝手套',
        description: '冰蚕金丝织就，空手亦可格挡兵刃。招架率+15%，空手可招架。',
        tags: ['defense'],
        effects: [{ type: 'parry_mod', value: 0.15 }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'silk_guard' }] }],
    },
    {
        id: 'herb_pouch',
        name: '蜂草鱼囊',
        description: '玉蜂浆、断肠草、寒潭白鱼所制，每 3 秒自动化解一层毒素，且恢复2点气血',
        tags: ['trigger'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'herb_pouch' }] }],
    },
    {
        id: 'snake_gall',
        name: '蛇胆',
        description: '普斯曲蛇的蛇胆，强筋健骨。力道+2，根骨+2，毒抗+70%。',
        tags: ['buff'],
        effects: [{ type: 'stat_buff', attrs: { strength: 2, vitality: 2 } }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'poison_resist' }] }],
    },
    {
        id: 'fiery_eyes',
        name: '火眼金睛',
        description: '历经焚炼，目光如炬，洞察入微。洞察+4。',
        tags: ['buff'],
        effects: [{ type: 'stat_buff', attrs: { insight: 4 } }],
    },
    {
        id: 'soft_hedgehog_mail',
        name: '软猬甲',
        description: '以软猬兽皮制成的甲衣，柔韧而多刺。减免所有伤害；受拳脚攻击时反伤并令对手流血。',
        tags: ['defense'],
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
]

/** 按 ID 查找物品 */
export function getArtifact(id: string): Artifact | undefined {
    return ARTIFACTS.find((a) => a.id === id)
}

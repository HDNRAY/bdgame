import type { Artifact } from '../entities/artifact'

/** 所有可获取物品：义体（带副作用） + 奇物（特殊效果） */
export const ARTIFACTS: Artifact[] = [
    // ── 义体（tag: implant） ──
    {
        id: 'titanium_arm',
        name: '钛合金臂',
        description: '重型钛合金义肢，力大无穷。',
        tags: ['implant'],
        effects: [
            { type: 'stat_buff', attrs: { strength: 4, dexterity: 4 } },
            { type: 'stat_buff', attrs: { agility: -2 } },
        ],
    },
    {
        id: 'hydraulic_leg',
        name: '液压腿',
        description: '液压驱动义腿，爆发力惊人。',
        tags: ['implant'],
        effects: [
            { type: 'move_efficiency', value: 0.2 },
            { type: 'stat_buff', attrs: { agility: -1 } },
        ],
    },
    {
        id: 'mechanical_eye',
        name: '机械眼球',
        description: '精密光学义眼，洞察入微。',
        tags: ['implant'],
        effects: [
            { type: 'stat_buff', attrs: { insight: 2 } },
            { type: 'max_ap_mod', value: -1 },
        ],
    },
    {
        id: 'muscle_boost',
        name: '肌肉强化针',
        description: '肌肉强化注射剂，代价是身体负担。',
        tags: ['implant'],
        effects: [
            { type: 'stat_buff', attrs: { strength: 2, vitality: 2 } },
            { type: 'max_hp_mod', value: -20 },
        ],
    },
    {
        id: 'heart_pump',
        name: '心肺泵',
        description: '辅助循环系统，全面提升体能。',
        tags: ['implant'],
        effects: [
            { type: 'stat_buff', attrs: { strength: 1, agility: 1, dexterity: 1, vitality: 1 } },
            { type: 'max_ap_mod', value: -2 },
        ],
    },
    {
        id: 'neural_net',
        name: '人造神经网络',
        description: '仿生神经增强网，反应速度提升。',
        tags: ['implant'],
        effects: [
            { type: 'stat_buff', attrs: { agility: 1, dexterity: 2, insight: 1 } },
            { type: 'fumble_chance', value: 0.05 },
        ],
    },
    {
        id: 'combat_chip',
        name: '战斗芯片',
        description: '战术辅助芯片，大幅提升悟性。',
        tags: ['implant'],
        effects: [
            { type: 'stat_buff', attrs: { wisdom: 4 } },
            { type: 'fumble_chance', value: 0.05 },
        ],
    },
    {
        id: 'power_furnace',
        name: '便携式动力炉',
        description: '微型核聚变动力炉，能量永不枯竭。',
        tags: ['implant'],
        effects: [
            { type: 'max_ap_mod', value: 4 },
            { type: 'permanent_burn', value: 1 },
        ],
    },

    // ── 奇物（tag 待定） ──
    {
        id: 'blood_thorn_ring',
        name: '血棘戒',
        description: '暴击时在伤口注入血气，引发持续流血。',
        tags: ['trigger'],
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
        tags: ['trigger'],
    },
    {
        id: 'tiger_eye',
        name: '虎彻之眼',
        description: '进入居合时双目如虎，洞察先机。',
        tags: ['trigger'],
        triggers: [{ condition: { type: 'on_buff', buffId: 'iaijutsu' }, actionId: '_tiger_eye_foresight' }],
    },
    {
        id: 'qi_guard',
        name: '吞炁囊',
        description: '开局凝聚炁盾，吸收炁招式伤害2点，共10次。',
        tags: ['trigger'],
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'qi_shield', stacks: 20 }] },
        ],
    },
    {
        id: 'iron_will',
        name: '乌铠',
        description: '受到超过5点的斩/刺/钝伤害时，消耗1AP减少3点。',
        tags: ['trigger'],
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
        tags: ['trigger'],
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
            { condition: { type: 'on_parry' }, effects: [{ type: 'status', status: 'frost', stacks: 1, chance: 1 }] },
        ],
    },
    {
        id: 'poison_coating',
        name: '淬毒工具',
        description: '刃上淬毒，割裂或刺击时概率令其中毒。',
        tags: [],
        triggers: [
            {
                condition: { type: 'on_dealt_damage' },
                effects: [{ type: 'status', status: 'poison', stacks: 1, chance: 0.3 }],
            },
        ],
    },
    {
        id: 'western_poison',
        name: '西域奇毒',
        description: '剧毒入体，麻痹神经。每次中毒时叠加一层麻痹。',
        tags: ['debuff'],
        triggers: [
            {
                condition: { type: 'on_poison' },
                effects: [{ type: 'status', status: 'paralyze', stacks: 1, chance: 1 }],
            },
        ],
    },
    {
        id: 'other_mountain',
        name: '他山之石',
        description: '博采众长，洞察入微。宁毅所赠的现代搏击笔记。',
        tags: ['buff'],
        effects: [{ type: 'stat_buff', attrs: { insight: 4, dexterity: 2 } }],
    },
    {
        id: 'cinnabar_mole',
        name: '守宫砂',
        description: '龙虎山秘传之印，每三击蓄满雷印，下一击爆发×1.5。',
        tags: ['trigger', 'electric'],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'cinnabar_mark' }] }],
    },
]

/** 按 ID 查找物品 */
export function getArtifact(id: string): Artifact | undefined {
    return ARTIFACTS.find((a) => a.id === id)
}

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
        triggers: [{ condition: { type: 'battle_start' }, actionId: '_innate_seed_start' }],
    },
    {
        id: 'tiger_eye',
        name: '虎彻之眼',
        description: '进入居合时双目如虎，洞察先机。',
        tags: ['trigger'],
        triggers: [{ condition: { type: 'on_buff', buffId: 'iaijutsu' }, actionId: '_tiger_eye_foresight' }],
    },
]

/** 按 ID 查找物品 */
export function getArtifact(id: string): Artifact | undefined {
    return ARTIFACTS.find((a) => a.id === id)
}

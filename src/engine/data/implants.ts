import type { Artifact } from '../entities/artifact'

/** 义体注册表 */
export const IMPLANTS: Artifact[] = [
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
    {
        id: 'blood_thorn_ring',
        name: '血棘戒',
        description: '暴击时在伤口注入血气，引发持续流血。',
        tags: ['implant'],
        triggers: [{ condition: { type: 'on_crit' }, actionId: '_blood_thorn_bleed' }],
    },
]

/** 按 ID 查找义体 */
export function getArtifact(id: string): Artifact | undefined {
    return IMPLANTS.find((i) => i.id === id)
}

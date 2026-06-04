import type { ActionDefinition } from '../entities/action'
import { QI_SKILLS } from './forging'

/**
 * MVP 招式清单
 * 每招机制唯一，不重复。
 */
export const MVP_ACTIONS: ActionDefinition[] = [
    // ── 拳掌系 ──
    {
        id: 'straight_punch',
        name: '正拳',
        description: '一记标准正拳，直取中门。',
        requiredTags: ['blunt'],
        apCost: 3,
        tags: [],
        effects: [{ type: 'damage', scaling: { strength: 0.4 } }],
    },
    {
        id: 'crushing_blow',
        name: '崩拳',
        description: '蓄力一击，造成崩劲伤害。',
        requiredTags: ['blunt'],
        apCost: 5,
        tags: ['cripple'],
        effects: [
            { type: 'damage', scaling: { strength: 0.4 } },
            { type: 'cripple', ratio: 0.1 },
        ],
    },
    {
        id: 'iron_charge',
        name: '铁山靠',
        description: '近距离冲撞，附带麻痹效果。',
        requiredTags: ['blunt'],
        apCost: 7,
        tags: ['paralyze', 'self_damage'],
        effects: [
            { type: 'damage', scaling: { strength: 0.6 } },
            { type: 'status', status: 'paralyze', stacks: 2, chance: 0.6 },
            { type: 'self_damage', ratio: 0.04 },
        ],
    },
    {
        id: 'flick',
        name: '弹指',
        description: '弹指间弹出气劲，带麻痹效果。',
        requiredTags: [],
        apCost: 2,
        tags: ['paralyze'],
        effects: [
            { type: 'fixed_damage', value: 1 },
            { type: 'status', status: 'paralyze', stacks: 1, chance: 0.3 },
        ],
    },

    // ── 暗器系 ──

    // ── 长枪系 ──
    {
        id: 'thrust',
        name: '刺击',
        description: '一往无前的直刺。',
        requiredTags: ['pierce'],
        apCost: 4,
        tags: ['bleed'],
        effects: [
            { type: 'damage', scaling: { strength: 0.5 } },
            { type: 'status', status: 'bleed', stacks: 1, chance: 0.5 },
        ],
    },
    {
        id: 'sweep',
        name: '横扫千军',
        description: '横挥武器，攻击范围内所有敌人。',
        requiredTags: ['slash'],
        apCost: 6,
        tags: ['aoe'],
        effects: [
            { type: 'damage', scaling: { strength: 0.4 } },
            { type: 'aoe_range', range: 1 },
        ],
    },
    {
        id: 'fissure',
        name: '裂地击',
        description: '猛砸地面，造成冲击波。',
        requiredTags: ['blunt'],
        apCost: 8,
        tags: ['paralyze', 'ignore_parry'],
        effects: [
            { type: 'damage', scaling: { strength: 0.6 } },
            { type: 'status', status: 'paralyze', stacks: 2, chance: 0.6 },
            { type: 'ignore_parry' },
        ],
    },

    // ── 暗器系 ──
    {
        id: 'needle',
        name: '飞针',
        description: '三枚飞针破空而去。',
        requiredTags: ['pierce'],
        apCost: 3,
        tags: ['paralyze'],
        effects: [
            { type: 'damage', scaling: { dexterity: 0.25 } },
            { type: 'status', status: 'paralyze', stacks: 1, chance: 0.3 },
        ],
    },
    {
        id: 'poison_dart',
        name: '毒镖',
        description: '淬毒飞镖，见血封喉。',
        requiredTags: ['pierce'],
        apCost: 5,
        tags: ['poison'],
        effects: [
            { type: 'damage', scaling: { dexterity: 0.3 } },
            { type: 'status', status: 'poison', stacks: 1, chance: 0.4 },
        ],
    },
    {
        id: 'tempest',
        name: '暴雨梨花',
        description: '一瞬间射出数十枚暗器。',
        requiredTags: ['pierce'],
        apCost: 8,
        tags: ['fixed_damage', 'poison', 'paralyze', 'bleed'],
        effects: [
            { type: 'fixed_damage', value: 8 },
            { type: 'status', status: 'poison', stacks: 1, chance: 0.3 },
            { type: 'status', status: 'paralyze', stacks: 1, chance: 0.3 },
            { type: 'status', status: 'bleed', stacks: 1, chance: 0.3 },
        ],
        maxUses: 2,
    },

    // ── 新增招式 ──
    {
        id: 'tremor_stomp',
        name: '震脚',
        description: '猛踏地面，震晕对手。',
        requiredTags: [],
        apCost: 5,
        tags: ['stun'],
        effects: [
            { type: 'damage', scaling: { strength: 0.3 } },
            { type: 'status', status: 'stun', stacks: 1, chance: 1.0 },
        ],
    },
    {
        id: 'break_formation',
        name: '破军',
        description: '一往无前，破除一切负面效果。',
        requiredTags: [],
        apCost: 3,
        tags: ['cleanse'],
        effects: [{ type: 'cleanse' }],
        maxUses: 1,
    },
    {
        id: 'pursuit_thrust',
        name: '追刺',
        description: '趁虚而入，追击刺击。',
        requiredTags: ['pierce'],
        apCost: 2,
        tags: ['bleed'],
        effects: [
            { type: 'damage', scaling: { strength: 0.3 } },
            { type: 'status', status: 'bleed', stacks: 1, chance: 0.6 },
        ],
    },
    {
        id: 'qi_bolt',
        name: '炁弹',
        description: '凝聚炁劲远程攻击。',
        requiredTags: [],
        apCost: 0,
        tags: [],
        effects: [{ type: 'fixed_damage', value: 4 }],
        maxUses: 3,
        extraPreDelay: 100,
        range: [0, 5],
    },
    {
        id: 'jab',
        name: '刺拳',
        description: '一记快速刺拳，消耗极低。',
        requiredTags: ['blunt'],
        apCost: 1,
        tags: [],
        effects: [{ type: 'damage', scaling: { strength: 0.2 } }],
    },
    {
        id: 'orb_shot',
        name: '法珠',
        description: '',
        requiredTags: [],
        apCost: 1,
        tags: [],
        effects: [{ type: 'fixed_damage', value: 3 }],
        extraPreDelay: 300,
        extraStunTime: 800,
    },
    {
        id: 'restore_ap',
        name: '回炁',
        description: '恢复 1 AP。',
        requiredTags: [],
        apCost: 0,
        tags: [],
        target: 'self',
        effects: [{ type: 'restore_ap', value: 1 }],
        maxUses: 999,
    },
    {
        id: 'summon_haste',
        name: '御物加速',
        description: '召唤物加速 100ms。',
        requiredTags: [],
        apCost: 0,
        tags: [],
        target: 'self',
        effects: [{ type: 'summon_speed', value: 100 }],
        maxUses: 999,
    },
    {
        id: 'agility_steal',
        name: '汲灵',
        description: '命中时 30% 吸取身法 3 点，持续 2 秒。',
        requiredTags: [],
        apCost: 0,
        tags: [],
        chance: 0.7,
        effects: [{ type: 'stat_transfer', stat: 'agility', value: 1, duration: 2000 }],
        maxUses: 999,
    },
]

/** 辅招 */
export const BONUS_ACTIONS: ActionDefinition[] = []

/** 合并所有招式（含辅招、炁技） */
const ALL_ACTIONS = [...MVP_ACTIONS, ...BONUS_ACTIONS, ...QI_SKILLS]

/** 按 ID 查找 */
export function getAction(id: string): ActionDefinition | undefined {
    return ALL_ACTIONS.find((a) => a.id === id)
}

/** 按武器标签过滤（空数组招式 = 任意武器可用） */
export function getActionsByWeapon(weaponTags: import('../data/weapons').WeaponTag[]): ActionDefinition[] {
    return ALL_ACTIONS.filter((a) => {
        if (a.requiredTags.length === 0) return true
        return a.requiredTags.some((tag) => weaponTags.includes(tag))
    })
}

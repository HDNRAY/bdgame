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
        weaponType: 'fist',
        apCost: 3,
        bestDistance: 1,
        tags: [],
        effects: [{ type: 'damage', scaling: { strength: 0.4 } }],
    },
    {
        id: 'crushing_blow',
        name: '崩拳',
        weaponType: 'fist',
        apCost: 6,
        bestDistance: 1,
        tags: ['cripple'],
        effects: [
            { type: 'damage', scaling: { strength: 0.4 } },
            { type: 'cripple', ratio: 0.1 },
        ],
    },
    {
        id: 'iron_charge',
        name: '铁山靠',
        weaponType: 'fist',
        apCost: 7,
        bestDistance: 0,
        tags: ['paralyze', 'self_damage'],
        effects: [
            { type: 'damage', scaling: { strength: 0.6 } },
            { type: 'status', status: 'paralyze', stacks: 2, chance: 0.6 },
            { type: 'self_damage', ratio: 0.03 },
        ],
    },
    {
        id: 'flick',
        name: '弹指',
        weaponType: 'fist',
        apCost: 2,
        bestDistance: 2,
        tags: ['interrupt'],
        effects: [{ type: 'damage', scaling: { technique: 0.2 } }, { type: 'interrupt' }],
    },

    // ── 暗器系 ──

    // ── 长枪系 ──
    {
        id: 'thrust',
        name: '刺击',
        weaponType: 'spear',
        apCost: 4,
        bestDistance: 3,
        tags: ['bleed'],
        effects: [
            { type: 'damage', scaling: { strength: 0.5 } },
            { type: 'status', status: 'bleed', stacks: 1, chance: 0.4 },
        ],
    },
    {
        id: 'sweep',
        name: '横扫千军',
        weaponType: 'spear',
        apCost: 6,
        bestDistance: 3,
        tags: ['aoe'],
        effects: [
            { type: 'damage', scaling: { strength: 0.4 } },
            { type: 'aoe_range', range: 1 },
        ],
    },
    {
        id: 'fissure',
        name: '裂地击',
        weaponType: 'spear',
        apCost: 8,
        bestDistance: 2,
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
        weaponType: 'thrown',
        apCost: 3,
        bestDistance: 4,
        tags: ['paralyze'],
        effects: [
            { type: 'damage', scaling: { technique: 0.25 } },
            { type: 'status', status: 'paralyze', stacks: 1, chance: 0.3 },
        ],
    },
    {
        id: 'poison_dart',
        name: '毒镖',
        weaponType: 'thrown',
        apCost: 5,
        bestDistance: 4,
        tags: ['poison'],
        effects: [
            { type: 'damage', scaling: { technique: 0.3 } },
            { type: 'status', status: 'poison', stacks: 1, chance: 0.4 },
        ],
    },
    {
        id: 'tempest',
        name: '暴雨梨花',
        weaponType: 'thrown',
        apCost: 8,
        bestDistance: 4,
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
        weaponType: 'fist',
        apCost: 5,
        bestDistance: 1,
        tags: ['stun'],
        effects: [
            { type: 'damage', scaling: { strength: 0.3 } },
            { type: 'status', status: 'stun', stacks: 1, chance: 1.0 },
        ],
    },
    {
        id: 'break_formation',
        name: '破军',
        weaponType: 'spear',
        apCost: 3,
        bestDistance: 3,
        tags: ['cleanse'],
        effects: [{ type: 'cleanse' }],
        maxUses: 1,
    },
    {
        id: 'pursuit_thrust',
        name: '追刺',
        weaponType: 'spear',
        apCost: 3,
        bestDistance: 3,
        tags: ['bleed'],
        effects: [
            { type: 'damage', scaling: { strength: 0.3 } },
            { type: 'status', status: 'bleed', stacks: 1, chance: 0.6 },
        ],
    },
    {
        id: 'qi_bolt',
        name: '炁弹',
        weaponType: 'fist',
        apCost: 0,
        bestDistance: 4,
        tags: [],
        effects: [{ type: 'fixed_damage', value: 4 }],
        maxUses: 3,
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

/** 按武器类型过滤 */
export function getActionsByWeapon(weapon: string): ActionDefinition[] {
    return ALL_ACTIONS.filter((a) => a.weaponType === weapon)
}

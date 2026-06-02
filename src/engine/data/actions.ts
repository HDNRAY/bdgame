import type { ActionDefinition } from '../entities/action'

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
        effects: [{ type: 'damage', scaling: { strength: 0.8 } }],
    },
    {
        id: 'crushing_blow',
        name: '崩拳',
        weaponType: 'fist',
        apCost: 6,
        bestDistance: 1,
        tags: ['cripple'],
        effects: [
            { type: 'damage', scaling: { strength: 0.8 } },
            { type: 'cripple', ratio: 0.1 },
        ],
    },
    {
        id: 'iron_charge',
        name: '铁山靠',
        weaponType: 'fist',
        apCost: 7,
        bestDistance: 0,
        tags: ['stagger', 'self_damage'],
        effects: [
            { type: 'damage', scaling: { strength: 1.2 } },
            { type: 'status', status: 'stagger', stacks: 2 },
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
        effects: [{ type: 'damage', scaling: { technique: 0.4 } }, { type: 'interrupt' }],
    },

    // ── 刀剑系 ──
    {
        id: 'horizontal_slash',
        name: '横斩',
        weaponType: 'sword',
        apCost: 4,
        bestDistance: 2,
        tags: [],
        effects: [{ type: 'damage', scaling: { strength: 0.6, technique: 0.4 } }],
    },
    {
        id: 'iaijutsu',
        name: '居合',
        weaponType: 'sword',
        apCost: 7,
        bestDistance: 2,
        tags: ['first_strike'],
        effects: [{ type: 'damage', scaling: { strength: 0.8, technique: 0.6 } }, { type: 'first_strike' }],
    },
    {
        id: 'swallow_return',
        name: '燕返',
        weaponType: 'sword',
        apCost: 5,
        bestDistance: 2,
        tags: ['counter'],
        effects: [
            { type: 'damage', scaling: { strength: 0.6, technique: 0.4 } },
            { type: 'counter_on_dodge', damageRatio: 0.8 },
        ],
    },

    // ── 长枪系 ──
    {
        id: 'thrust',
        name: '刺击',
        weaponType: 'spear',
        apCost: 4,
        bestDistance: 3,
        tags: [],
        effects: [{ type: 'damage', scaling: { strength: 1.0 } }],
    },
    {
        id: 'sweep',
        name: '横扫千军',
        weaponType: 'spear',
        apCost: 6,
        bestDistance: 3,
        tags: ['aoe'],
        effects: [
            { type: 'damage', scaling: { strength: 0.8 } },
            { type: 'aoe_range', range: 1 },
        ],
    },
    {
        id: 'fissure',
        name: '裂地击',
        weaponType: 'spear',
        apCost: 8,
        bestDistance: 2,
        tags: ['stagger', 'ignore_parry'],
        effects: [
            { type: 'damage', scaling: { strength: 1.2 } },
            { type: 'status', status: 'stagger', stacks: 2 },
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
            { type: 'damage', scaling: { technique: 0.5 } },
            { type: 'status', status: 'paralyze', stacks: 1 },
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
            { type: 'damage', scaling: { technique: 0.6 } },
            { type: 'status', status: 'poison', stacks: 1 },
        ],
    },
    {
        id: 'tempest',
        name: '暴雨梨花',
        weaponType: 'thrown',
        apCost: 8,
        bestDistance: 4,
        tags: ['fixed_damage'],
        effects: [
            { type: 'fixed_damage', value: 15 },
            { type: 'status', status: 'paralyze', stacks: 1 },
        ],
        maxUses: 2,
    },

    // ── 御物系 ──
    {
        id: 'spirit_sword',
        name: '御剑',
        weaponType: 'control',
        apCost: 5,
        bestDistance: 4,
        tags: [],
        effects: [{ type: 'damage', scaling: { wisdom: 1.0 } }],
    },
    {
        id: 'spirit_shield',
        name: '御剑防御',
        weaponType: 'control',
        apCost: 0,
        bestDistance: 3,
        tags: [],
        effects: [{ type: 'damage', scaling: { wisdom: 0 } }],
        bonus: true,
    },
    {
        id: 'spirit_impact',
        name: '御器冲击',
        weaponType: 'control',
        apCost: 7,
        bestDistance: 4,
        tags: ['knockback'],
        effects: [
            { type: 'damage', scaling: { wisdom: 1.2 } },
            { type: 'knockback', distance: 2 },
        ],
        maxUses: 2,
    },
]

/** 按 ID 查找 */
export function getAction(id: string): ActionDefinition | undefined {
    return MVP_ACTIONS.find((a) => a.id === id)
}

/** 按武器类型过滤 */
export function getActionsByWeapon(weapon: string): ActionDefinition[] {
    return MVP_ACTIONS.filter((a) => a.weaponType === weapon)
}

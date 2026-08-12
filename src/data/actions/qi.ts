import type { ActionDefinition } from '../../engine/entities/action'

/** 炁技 —— 锻体解锁的辅招 */
export const QI_SKILLS: ActionDefinition[] = [
    {
        id: 'qi_gather',
        name: '聚炁',
        description: '集中炁劲，力量翻倍。',
        requiredTags: [],
        apCost: 2,
        tags: ['buff', 'pre_action'],
        target: 'self',
        effects: [{ type: 'stat_multiply', stat: 'strength', multiplier: 2 }],
    },
    {
        id: 'qi_bolt',
        name: '炁弹',
        description: '凝聚炁劲远程攻击。',
        requiredTags: [],
        apCost: 2,
        tags: ['qi', 'range', 'qi_action'],
        effects: [{ type: 'damage', scaling: { wisdom: 0.2 }, base: 2.4 }],
        extraPreDelay: 200,
        getRange: () => [2, 6],
    },
    {
        id: 'qi_blade',
        name: '炁刃',
        description: '凝炁成刃，近身斩击。无视招架，一半伤害穿透。',
        requiredTags: [],
        apCost: 2,
        tags: ['qi', 'melee', 'slash', 'pierce', 'qi_action'],
        getRange: () => [0, 2],
        effects: [
            { type: 'ignore_parry' },
            { type: 'damage', scaling: { wisdom: 0.2, dexterity: 0.1 }, piercingRatio: 0.4 },
        ],
    },
    {
        id: 'restore_ap',
        name: '回炁',
        description: '恢复 1 AP。',
        requiredTags: [],
        apCost: 0,
        tags: ['qi'],
        target: 'self',
        effects: [{ type: 'restore_ap', value: 1 }],
    },
    {
        id: 'qinlong_gong',
        name: '擒龙功',
        description: '隔空擒龙，夺人兵刃。',
        requiredTags: ['unarmed'],
        apCost: 2,
        tags: ['qi', 'debuff', 'range'],
        getRange: () => [1, 3],
        effects: [
            { type: 'damage', scaling: { strength: 0.1, wisdom: 0.1 } },
            { type: 'disarm', chance: 0.3 },
        ],
    },
]

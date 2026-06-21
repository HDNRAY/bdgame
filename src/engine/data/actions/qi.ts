import type { ActionDefinition } from '../../entities/action'

/** 炁技 —— 锻体解锁的辅招 */
export const QI_SKILLS: ActionDefinition[] = [
    {
        id: 'qi_focus',
        name: '凝炁',
        description: '凝聚体内炁劲，全属性小幅提升。',
        requiredTags: [],
        apCost: 1,
        tags: ['buff', 'support'],
        target: 'self',
        maxUses: 1,
        effects: [{ type: 'add_buff', buffId: 'qi_state' }],
    },
    {
        id: 'qi_gather',
        name: '聚炁',
        description: '集中炁劲，力量翻倍。',
        requiredTags: [],
        apCost: 3,
        tags: ['buff', 'support'],
        target: 'self',
        effects: [
            { type: 'stat_multiply', stat: 'strength', multiplier: 2, duration: { attr: 'wisdom', multiplier: 150 } },
            { type: 'add_buff', buffId: 'qi_state' },
        ],
    },
    {
        id: 'qi_bolt',
        name: '炁弹',
        description: '凝聚炁劲远程攻击。',
        requiredTags: [],
        apCost: 2,
        tags: ['qi', 'range'],
        effects: [{ type: 'damage', scaling: { wisdom: 0.2 }, base: 2.4 }],
        extraPreDelay: 200,
        getRange: () => [3, 8] as [number, number],
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
        maxUses: 999,
    },
]

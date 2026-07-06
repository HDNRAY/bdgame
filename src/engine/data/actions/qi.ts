import type { ActionDefinition } from '../../entities/action'

/** 炁技 —— 锻体解锁的辅招 */
export const QI_SKILLS: ActionDefinition[] = [
    {
        id: 'qi_gather',
        name: '聚炁',
        description: '集中炁劲，力量翻倍。',
        requiredTags: [],
        apCost: 3,
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
        tags: ['qi', 'range'],
        effects: [{ type: 'damage', scaling: { wisdom: 0.2 }, base: 2.4 }],
        extraPreDelay: 200,
        getRange: () => [2, 6],
    },
    {
        id: 'restore_ap',
        name: '回炁',
        description: '恢复 1 AP。',
        requiredTags: [],
        apCost: 0,
        chanCost: 5,
        tags: ['qi'],
        target: 'self',
        effects: [{ type: 'restore_ap', value: 1 }],
    },
]

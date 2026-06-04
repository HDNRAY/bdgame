import type { ActionDefinition } from '../entities/action'

/** 炁技 —— 锻体解锁的辅招 */
export const QI_SKILLS: ActionDefinition[] = [
    {
        id: 'qi_focus',
        name: '凝炁',
        description: '凝聚体内炁劲，全属性小幅提升。',
        requiredTags: [],
        apCost: 1,
        tags: [],
        effects: [],
        bonus: true,
        bonusTiming: { type: 'before_main' },
        maxUses: 1,
        triggerEffect: [
            {
                type: 'stat_buff' as const,
                attrs: { strength: 1, vitality: 1, dexterity: 1, technique: 1, insight: 1, wisdom: 1 },
                duration: { attr: 'wisdom' as const, multiplier: 1000 },
            },
        ],
    },
    {
        id: 'qi_gather',
        name: '聚炁',
        description: '集中炁劲，力量翻倍。',
        requiredTags: [],
        apCost: 1,
        tags: [],
        effects: [],
        bonus: true,
        bonusTiming: { type: 'before_main' },
        maxUses: 1,
        triggerEffect: [
            {
                type: 'stat_multiply',
                stat: 'strength',
                multiplier: 2,
                duration: { attr: 'wisdom', multiplier: 150 },
            },
        ],
    },
    // TODO: 愈炁 — 回血，触发器类
    // TODO: 炁弹 — 远程固定伤害
]

import type { ActionDefinition, BonusTiming } from '../entities/action'

const ALL_ATTR_STATS = ['strength', 'vitality', 'dexterity', 'technique', 'insight', 'wisdom']

/** 炁技 —— 锻体解锁的辅招 */
export const QI_SKILLS: ActionDefinition[] = [
    {
        id: 'qi_focus',
        name: '凝炁',
        weaponType: 'fist',
        apCost: 1,
        bestDistance: 1,
        tags: [],
        effects: [],
        bonus: true,
        bonusTiming: 'before_main',
        maxUses: 1,
        triggerEffect: {
            type: 'stat_buff_all' as const,
            buffs: ALL_ATTR_STATS.map((stat) => ({ stat, value: 1 })),
            duration: 'battle' as const,
        },
    },
    {
        id: 'qi_gather',
        name: '聚炁',
        weaponType: 'fist',
        apCost: 1,
        bestDistance: 1,
        tags: [],
        effects: [],
        bonus: true,
        bonusTiming: 'before_main',
        maxUses: 1,
        triggerEffect: { type: 'stat_multiply', stat: 'strength', multiplier: 2, duration: 'turn' },
    },
    // TODO: 愈炁 — 回血，触发器类
    // TODO: 炁弹 — 远程固定伤害
]

/** 锻体 buff 表：等级 → 属性加成 */
export function getForgingBuffs(level: number): { stat: string; value: number }[] {
    const table: Record<number, { stat: string; value: number }[]> = {
        1: [{ stat: 'strength', value: 1 }],
        2: [
            { stat: 'strength', value: 1 },
            { stat: 'vitality', value: 1 },
        ],
        3: [
            { stat: 'strength', value: 1 },
            { stat: 'vitality', value: 1 },
            { stat: 'dexterity', value: 1 },
        ],
        4: [
            { stat: 'strength', value: 1 },
            { stat: 'vitality', value: 1 },
            { stat: 'dexterity', value: 1 },
            { stat: 'technique', value: 1 },
        ],
        5: [
            { stat: 'strength', value: 1 },
            { stat: 'vitality', value: 1 },
            { stat: 'dexterity', value: 1 },
            { stat: 'technique', value: 1 },
            { stat: 'insight', value: 1 },
        ],
        6: [
            { stat: 'strength', value: 1 },
            { stat: 'vitality', value: 1 },
            { stat: 'dexterity', value: 1 },
            { stat: 'technique', value: 1 },
            { stat: 'insight', value: 1 },
            { stat: 'wisdom', value: 1 },
        ],
    }
    const buffs: { stat: string; value: number }[] = []
    for (let i = 1; i <= level; i++) {
        const b = table[i]
        if (b) for (const x of b) if (!buffs.find((y) => y.stat === x.stat)) buffs.push(x)
    }
    return buffs
}

/** 锻体 → 一组功法被动 ActionDefinition（battle_start 时触发） */
export function getForgingActions(level: number): ActionDefinition[] {
    const buffs = getForgingBuffs(level)
    return buffs.map((b) => ({
        id: `forging_${b.stat}`,
        name: `锻体-${b.stat}`,
        weaponType: 'fist' as const,
        apCost: 0,
        bestDistance: 1,
        tags: [],
        effects: [],
        bonus: true,
        bonusTiming: 'battle_start' as BonusTiming,
        triggerEffect: { type: 'stat_buff' as const, stat: b.stat, value: b.value, duration: 'battle' as const },
    }))
}

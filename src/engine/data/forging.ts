import type { ActionDefinition } from './action'

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
    },
    {
        id: 'qi_break',
        name: '破炁',
        weaponType: 'fist',
        apCost: 1,
        bestDistance: 1,
        tags: ['ignore_parry'],
        effects: [],
        bonus: true,
    },
    {
        id: 'qi_heal',
        name: '愈炁',
        weaponType: 'fist',
        apCost: 2,
        bestDistance: 1,
        tags: [],
        effects: [{ type: 'self_damage', ratio: -0.25 }], // 回复 25%
        bonus: true,
    },
    {
        id: 'qi_shadow',
        name: '影炁',
        weaponType: 'fist',
        apCost: 1,
        bestDistance: 1,
        tags: [],
        effects: [],
        bonus: true,
    },
    {
        id: 'qi_devour',
        name: '噬炁',
        weaponType: 'fist',
        apCost: 1,
        bestDistance: 1,
        tags: [],
        effects: [],
        bonus: true,
    },
    {
        id: 'qi_speed',
        name: '速炁',
        weaponType: 'fist',
        apCost: 1,
        bestDistance: 1,
        tags: [],
        effects: [],
        bonus: true,
    },
    {
        id: 'qi_blast',
        name: '炁弹',
        weaponType: 'fist',
        apCost: 3,
        bestDistance: 4,
        tags: ['fixed_damage'],
        effects: [{ type: 'fixed_damage', value: 0 }], // wisdom×1.2, runtime computed
        bonus: false, // 主招
    },
]

/** 锻体 buff 表：等级 → 属性加成 */
export function getForgingBuffs(level: number): { stat: string; value: number }[] {
  const table: Record<number, { stat: string; value: number }[]> = {
    1: [{ stat: 'strength', value: 1 }],
    2: [{ stat: 'strength', value: 1 }, { stat: 'vitality', value: 1 }],
    3: [{ stat: 'strength', value: 1 }, { stat: 'vitality', value: 1 }, { stat: 'dexterity', value: 1 }],
    4: [{ stat: 'strength', value: 1 }, { stat: 'vitality', value: 1 }, { stat: 'dexterity', value: 1 }, { stat: 'technique', value: 1 }],
    5: [{ stat: 'strength', value: 1 }, { stat: 'vitality', value: 1 }, { stat: 'dexterity', value: 1 }, { stat: 'technique', value: 1 }, { stat: 'insight', value: 1 }],
    6: [{ stat: 'strength', value: 1 }, { stat: 'vitality', value: 1 }, { stat: 'dexterity', value: 1 }, { stat: 'technique', value: 1 }, { stat: 'insight', value: 1 }, { stat: 'wisdom', value: 1 }],
  }
  const buffs: { stat: string; value: number }[] = []
  for (let i = 1; i <= level; i++) { const b = table[i]; if (b) for (const x of b) if (!buffs.find(y => y.stat === x.stat)) buffs.push(x) }
  return buffs
}

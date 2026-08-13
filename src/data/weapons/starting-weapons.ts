import type { WeaponDef } from './weapons'

/**
 * 初始可选武器完整定义
 *
 * 均为本文件独有定义，不与 weapons.ts 中任何武器共享。
 * 玩家开局时可选的武器池。选完可以一直用到通关，不强制换。
 * 这些武器不进奖励池（不会在事件节点中出现）。
 */
export const STARTING_WEAPONS: WeaponDef[] = [
    // ── 空手 ──
    {
        id: 'bare_hands',
        name: '赤手空拳',
        description: '什么都没有，但什么都有可能。',
        tags: ['unarmed', 'dual_wield'],
        effects: [{ type: 'stat_buff', attrs: { agility: 2 } }],
        range: [0, 2],
    },
    // ── 单手剑 ──
    {
        id: 'peach_sword',
        name: '桃木剑',
        description: '入门级单手剑，轻灵锐利。',
        tags: ['slash', 'pierce', 'parry', 'melee', 'one_handed'],
        range: [1, 3],
    },
    // ── 棍 ──
    {
        id: 'qimei_staff',
        name: '齐眉棍',
        description: '长棍一根，攻守兼备。',
        tags: ['parry', 'polearm', 'blunt'],
        range: [1, 4],
    },
    // ── 长枪 ──
    {
        id: 'long_spear',
        name: '长枪',
        description: '长枪一杆，势大力沉。',
        tags: ['pierce', 'parry', 'polearm'],
        range: [1, 4],
    },
    // ── 御物 ──
    {
        id: 'floating_silk',
        name: '七根丝',
        description: '一缕以炁御动的柔丝，可远可近，可硬可软，变幻莫测。',
        tags: ['imperial', 'range', 'pierce', 'summon'],
        bound: true,
        range: [0, 6],
        // 御物耗炁：每秒扣 0.7AP（7 丝）。丝 = 高频触发流：短前后摇、绵密输出、射程 7，每击喂 on_hit
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'yuwu_cost', stacks: 1 }] },
        ],
        summon: {
            id: 'silk',
            name: '游丝',
            maxCount: (self) => Math.min(7, 1 + Math.round(self.attrs.get('wisdom') / 2)),
            actionId: '_silk_shot',
        },
    },
    {
        id: 'tri_orb',
        name: '三相珠',
        description: '三颗由炁劲驱动的法珠，环绕主人旋转。',
        tags: ['imperial', 'parry', 'range', 'summon'],
        bound: true,
        range: [0, 6],
        // 御物耗炁：每秒扣 0.7AP（3 珠）。珠 = 纯伤害中速
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'yuwu_cost', stacks: 0.4 }] },
        ],
        summon: {
            id: 'orb',
            name: '法珠',
            maxCount: () => 3,
            actionId: '_orb_shot',
        },
    },
    {
        id: 'fei_jian',
        name: '黑云剑',
        description: '御剑飞行，剑气纵横。',
        tags: ['imperial', 'parry', 'slash', 'pierce', 'range', 'heavy', 'polearm', 'summon'],
        bound: true,
        range: [0, 6],
        // 御物耗炁：每秒扣 0.5AP（1 剑）。剑 = 慢速重击：单发 WIS×0.5、长前后摇、节奏沉
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'yuwu_cost', stacks: 0.4 }] },
        ],
        summon: {
            id: 'fei_jian',
            name: '黑云剑',
            maxCount: () => 1,
            actionId: '_fei_jian_shot',
        },
    },
    // ── 匕首 ──
    {
        id: 'dagger',
        name: '军用匕首',
        description: '短小而致命的匕首。',
        tags: ['pierce', 'unarmed', 'parry', 'slash', 'melee', 'one_handed'],
        effects: [{ type: 'stat_buff', attrs: { agility: 1 } }],
        range: [0, 2],
    },
]

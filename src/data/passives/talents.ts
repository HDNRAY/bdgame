import type { Talent } from '../../engine/entities/passive'

/** 天赋（绝学）注册表 */
export const TALENTS: Talent[] = [
    {
        id: 'ling_bo_wei_bu',
        name: '凌波微步',
        description: '绝世轻功，身法达到一定境界后自然领悟。步法精妙，身法不低于16。',
        tags: ['talent', 'buff'],
        requireAttrsMin: { agility: 20 },
        effects: [
            { type: 'haste', value: 200 },
            // 身法不低于 16：战中被减身法时兜住（与「洞察降低减半」同一套 stat_restriction 机制）
            {
                type: 'stat_restriction',
                check: (_char, attr, current, delta) =>
                    attr === 'agility' && delta < 0 && current + delta < 16 ? { delta: 16 - current } : null,
            },
        ],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'min_move_cost' }] }],
    },
    {
        id: 'zuoyou_hubo',
        name: '分心错手',
        description: '一心二用，双手交替出击，灵巧过人者可连续出手。',
        tags: ['talent', 'buff'],
        requireAttrsMin: { dexterity: 18 },
        requireAttrsMax: { wisdom: 4 },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'zuoyou_hubo' }] }],
    },
    {
        id: 'vitality_regen',
        name: '生生不息',
        description: '根骨强健，每3秒回复1+缺失生命的1%。',
        tags: ['heal', 'talent', 'buff'],
        requireAttrsMin: { vitality: 20 },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'vitality_regen' }] }],
    },
    {
        id: 'xiu_li_xuan_ji',
        name: '袖里玄机',
        description:
            '千丝万缕，只在衣袖之间。闪避获得1层缠劲；受伤消耗1层缠劲减免3点。每次触发招式叠1层玄机，9层满时下一招非辅助招式强化（必中、无视招架、必定暴击）。',
        tags: ['talent', 'buff', 'qi'],
        requireAttrsMin: { wisdom: 20 },
        triggers: [
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'xiu_li' }] },
            { condition: { type: 'on_action_trigger' }, effects: [{ type: 'add_buff', buffId: 'xuan_ji', stacks: 1 }] },
            {
                condition: {
                    type: 'on_buff',
                    buffId: 'xuan_ji',
                    check: (ctx) => {
                        const layer = ctx.engine?.state.pendingBuffs.get(`xuan_ji::${ctx.actor.id}`)
                        return !!layer && layer.restoreValue >= 9
                    },
                },
                effects: [{ type: 'add_buff', buffId: 'tianji_ready' }],
            },
        ],
    },
    {
        id: 'dongyou_zhuwei',
        name: '洞幽烛微',
        description: '洞察幽微，看破对手武学路数。对手每使用带某标签的招式，看破该标签一层；看破越深，该标签招式对你的闪避与减伤越高（各收敛至7%）。',
        tags: ['talent', 'buff'],
        requireAttrsMin: { insight: 20 },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'dongyou_zhuwei' }] }],
    },
    {
        id: 'yuanting_yuezhi',
        name: '渊渟岳峙',
        description: '渊深如潭，岳峙如山。永久罡体，身法/灵巧无法被降低。',
        tags: ['talent', 'buff', 'defense'],
        requireAttrsMin: { strength: 20 },
        effects: [
            {
                type: 'stat_restriction',
                check: (_char, attr, _cur, delta) => {
                    if ((attr === 'agility' || attr === 'dexterity') && delta < 0) return { skip: true }
                    return null
                },
            },
        ],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'yuanting_yuezhi' }] }],
    },
]

export function getTalent(id: string): Talent | undefined {
    return TALENTS.find((t) => t.id === id)
}

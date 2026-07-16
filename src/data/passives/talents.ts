import type { Talent } from '../../entities/passive'

/** 天赋（绝学）注册表 */
export const TALENTS: Talent[] = [
    {
        id: 'ling_bo_wei_bu',
        name: '凌波微步',
        description: '绝世轻功，身法达到一定境界后自然领悟。步法精妙，身法不低于15。',
        tags: ['talent', 'buff'],
        requireAttrsMin: { agility: 20 },
        effects: [
            { type: 'attr_floor', attrs: { agility: 16 } },
            { type: 'haste', value: 200 },
        ],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'min_move_cost' }] }],
    },
    {
        id: 'zuoyou_hubo',
        name: '左右互搏',
        description: '双手各自为战，灵巧过人者可一心二用。',
        tags: ['talent', 'buff'],
        requireAttrsMin: { dexterity: 18 },
        requireAttrsMax: { wisdom: 4 },
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'zuoyou_hubo' }] }],
    },
    {
        id: 'vitality_regen',
        name: '生生不息',
        description: '根骨强健，每2秒回复1+缺失生命的1%。',
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
        id: 'xiaowuxiang',
        name: '斗转星移',
        description: '洞察入微，以彼之道还施彼身。缠劲满溢时窥破对手功法破绽，复制其最契合自身武道的功法。',
        tags: ['talent', 'buff'],
        requireAttrsMin: { insight: 20 },
        triggers: [{ condition: { type: 'chan_overflow' }, actionId: '_xiaowuxiang_copy' }],
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

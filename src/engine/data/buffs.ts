import type { GameEntity } from '../entities/base'
import type { AttrName } from '../entities/attributes'

/** 消耗方式 */
export type BuffExpiry =
    | { type: 'duration'; ms: number }
    | { type: 'duration_by_attr'; attr: AttrName; multiplier: number }
    | { type: 'tick'; interval: number }
    | { type: 'trigger'; event: string; maxTriggers: number }
    | { type: 'consumed' }
    | { type: 'permanent' }

/** 叠层行为 */
export type BuffStacking = { type: 'none' } | { type: 'additive'; max?: number } | { type: 'independent' }

/** Buff 定义 */
export interface BuffDef extends GameEntity {
    value?: number
    /** 消耗方式 */
    expiry?: BuffExpiry
    /** 叠层行为 */
    stacking?: BuffStacking
    /** 每层属性修正 */
    attrMods?: Record<string, number>
    /** 连续眩晕递减 */
    consecutiveDiminish?: boolean
    /** DOT tick 间隔（ms） */
    tickInterval?: number
    /** tick 伤害基数 */
    dotDamage?: number
}

export const BUFF_DB: BuffDef[] = [
    // ── 战斗状态 ──
    {
        id: 'iaijutsu',
        name: '居合',
        description: '拔刀之势，蓄势待发。',
        tags: [],
        value: 0,
        expiry: { type: 'consumed' },
        stacking: { type: 'none' },
    },
    {
        id: 'foresight',
        name: '看破',
        description: '洞察先机，招架率+0.5。',
        tags: [],
        value: 0.5,
        expiry: { type: 'consumed' },
        stacking: { type: 'none' },
    },
    {
        id: 'mind_eye',
        name: '心眼',
        description: '心眼已开，暴击率+0.25。',
        tags: [],
        value: 0.25,
        expiry: { type: 'consumed' },
        stacking: { type: 'none' },
    },

    // ── 属性类 ──
    {
        id: 'stat_multiply',
        name: '超越',
        description: '属性临时倍增。',
        tags: [],
        expiry: { type: 'duration_by_attr', attr: 'wisdom', multiplier: 150 },
        stacking: { type: 'independent' },
    },
    { id: 'stat_buff', name: '内劲', description: '属性临时变化。', tags: [], stacking: { type: 'independent' } },
    {
        id: 'stat_transfer',
        name: '汲取',
        description: '吸取目标属性。',
        tags: [],
        expiry: { type: 'duration', ms: 2000 },
        stacking: { type: 'independent' },
    },

    // ── 负面状态 ──
    {
        id: 'paralyze',
        name: '麻痹',
        description: '身法、洞察降低。',
        tags: [],
        expiry: { type: 'duration', ms: 1800 },
        stacking: { type: 'independent' },
        attrMods: { agility: -2, insight: -1 },
    },
    {
        id: 'stun',
        name: '眩晕',
        description: '大幅降低身法、洞察（连续命中递减）。',
        tags: [],
        expiry: { type: 'duration', ms: 2000 },
        stacking: { type: 'independent' },
        consecutiveDiminish: true,
    },
    {
        id: 'burn',
        name: '灼烧',
        description: '持续火焰伤害。',
        tags: [],
        expiry: { type: 'tick', interval: 1000 },
        stacking: { type: 'additive' },
        dotDamage: 5,
    },
    {
        id: 'poison',
        name: '中毒',
        description: '持续毒素伤害。',
        tags: [],
        expiry: { type: 'tick', interval: 2000 },
        stacking: { type: 'additive' },
    },
    {
        id: 'bleed',
        name: '流血',
        description: '行动触发额外伤害。',
        tags: [],
        expiry: { type: 'trigger', event: 'action', maxTriggers: 5 },
        stacking: { type: 'additive' },
    },

    // ── 内部追踪 ──
    { id: 'stun_track', name: '眩晕连续', description: '连续眩晕计数（5秒窗口）。', tags: [] },

    // ── 永久修饰（构造期执行） ──
    { id: 'max_ap_mod', name: '失能', description: '最大AP变化。', tags: [], expiry: { type: 'permanent' } },
    { id: 'max_hp_mod', name: '失血', description: '最大HP变化。', tags: [], expiry: { type: 'permanent' } },
    { id: 'fumble_chance', name: '失心', description: '动作失败率。', tags: [], expiry: { type: 'permanent' } },
    {
        id: 'permanent_burn',
        name: '过热',
        description: '持续灼烧伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 3000,
        dotDamage: 1,
    },
]

export function getBuff(id: string): BuffDef | undefined {
    return BUFF_DB.find((b) => b.id === id)
}

import type { ActionConfig, RequiredCondition } from '../game/entities/action-config'
import { BUFF_DB, DEBUFF_DB, getBuff } from './buffs'

// ════════════════════════════════════════
//  出招必要条件（唯一表达：结构化条件）
//
//  - 数据源：本文件的 CONDITION_TYPES（编辑器与对手数据都从这里取类型与参数）
//  - 写入位置：ActionConfig.condition
//  - 解析入口：resolveCondition()，返回"生效的闸门"
//
//  语义是**闸门**：条件满足只代表"这招允许被选择"，
//  是否真的出招仍由 AI 按期望伤害/内息效率评分决定（详见 docs/gameplay-guide.md「出招条件」）。
// ════════════════════════════════════════

/**
 * 解析招式条件 → **生效的闸门**（唯一入口）。
 * 没设条件、条件为 always 时返回 undefined（= 无门槛）。
 */
export function resolveCondition(ac: ActionConfig | undefined): RequiredCondition | undefined {
    if (!ac?.condition) return undefined
    return ac.condition.type === 'always' ? undefined : ac.condition
}

// ── 结构化条件类型表（编辑器唯一数据源） ──

/** 条件参数种类：数字 / 百分比 / 状态 id / 状态标签 */
export type ConditionParamKind = 'number' | 'percent' | 'buff' | 'buffTag'

export interface ConditionParamSpec {
    key: string
    label: string
    kind: ConditionParamKind
    /** 默认值（也是编辑器打开时的初始值） */
    default: number | string
    min?: number
    max?: number
    step?: number
    unit?: string
}

export interface ConditionTypeDef {
    type: RequiredCondition['type']
    label: string
    params: ConditionParamSpec[]
    build: (v: Record<string, number | string>) => RequiredCondition
}

const num = (
    key: string,
    label: string,
    def: number,
    min: number,
    max: number,
    step = 1,
    unit?: string,
): ConditionParamSpec => ({ key, label, kind: 'number', default: def, min, max, step, unit })

const pctParam = (label: string, def: number): ConditionParamSpec => ({
    key: 'pct',
    label,
    kind: 'percent',
    default: def,
    min: 1,
    max: 99,
})

const buffParam = (label: string): ConditionParamSpec => ({ key: 'buffId', label, kind: 'buff', default: '' })
const tagParam = (label: string, def: string): ConditionParamSpec => ({
    key: 'tag',
    label,
    kind: 'buffTag',
    default: def,
})

/** 玩家可编辑的结构化条件类型。参数值统一以 number/string 传入 build() */
export const CONDITION_TYPES: ConditionTypeDef[] = [
    {
        type: 'always',
        label: '不设条件',
        params: [],
        build: () => ({ type: 'always' }),
    },
    {
        type: 'hp_below',
        label: '自身气血低于',
        params: [pctParam('阈值', 50)],
        build: (v) => ({ type: 'hp_below', ratio: Number(v.pct) / 100 }),
    },
    {
        type: 'hp_above',
        label: '自身气血高于',
        params: [pctParam('阈值', 50)],
        build: (v) => ({ type: 'hp_above', ratio: Number(v.pct) / 100 }),
    },
    {
        type: 'enemy_hp_below',
        label: '目标气血低于',
        params: [pctParam('阈值', 30)],
        build: (v) => ({ type: 'enemy_hp_below', ratio: Number(v.pct) / 100 }),
    },
    {
        type: 'enemy_hp_above',
        label: '目标气血高于',
        params: [pctParam('阈值', 50)],
        build: (v) => ({ type: 'enemy_hp_above', ratio: Number(v.pct) / 100 }),
    },
    {
        type: 'chan_above',
        label: '缠劲不低于',
        params: [num('value', '缠劲', 30, 0, 50, 5)],
        build: (v) => ({ type: 'chan_above', value: Number(v.value) }),
    },
    {
        type: 'chan_below',
        label: '缠劲低于',
        params: [num('value', '缠劲', 30, 1, 50, 5)],
        build: (v) => ({ type: 'chan_below', value: Number(v.value) }),
    },
    {
        type: 'ap_above',
        label: '内息不低于',
        params: [num('value', '内息', 4, 0, 20, 1)],
        build: (v) => ({ type: 'ap_above', value: Number(v.value) }),
    },
    {
        type: 'ap_below',
        label: '内息低于',
        params: [num('value', '内息', 4, 1, 20, 1)],
        build: (v) => ({ type: 'ap_below', value: Number(v.value) }),
    },
    {
        type: 'distance_less_than',
        label: '距离近于',
        params: [num('meters', '距离', 2, 0, 10, 0.5, 'm')],
        build: (v) => ({ type: 'distance_less_than', meters: Number(v.meters) }),
    },
    {
        type: 'distance_greater_than',
        label: '距离远于',
        params: [num('meters', '距离', 3, 0, 10, 0.5, 'm')],
        build: (v) => ({ type: 'distance_greater_than', meters: Number(v.meters) }),
    },
    {
        type: 'distance_between',
        label: '距离在区间内',
        params: [num('min', '最近', 1, 0, 10, 0.5, 'm'), num('max', '最远', 3, 0, 10, 0.5, 'm')],
        // 端点写反时自动对调：否则条件恒不成立，招式会静默地永不出手
        build: (v) => {
            const [min, max] = [Number(v.min), Number(v.max)].sort((a, b) => a - b)
            return { type: 'distance_between', min, max }
        },
    },
    {
        type: 'buff_stacks_above',
        label: '自身状态层数不少于',
        params: [buffParam('状态'), num('minStacks', '层数', 3, 1, 20, 1)],
        build: (v) => ({ type: 'buff_stacks_above', buffId: String(v.buffId), minStacks: Number(v.minStacks) }),
    },
    {
        type: 'buff_stacks_below',
        label: '自身状态层数少于',
        params: [buffParam('状态'), num('maxStacks', '层数', 2, 1, 20, 1)],
        build: (v) => ({ type: 'buff_stacks_below', buffId: String(v.buffId), maxStacks: Number(v.maxStacks) }),
    },
    {
        type: 'enemy_buff_stacks_above',
        label: '目标状态层数不少于',
        params: [buffParam('状态'), num('minStacks', '层数', 3, 1, 20, 1)],
        build: (v) => ({ type: 'enemy_buff_stacks_above', buffId: String(v.buffId), minStacks: Number(v.minStacks) }),
    },
    {
        type: 'enemy_buff_stacks_below',
        label: '目标状态层数少于',
        params: [buffParam('状态'), num('maxStacks', '层数', 2, 1, 20, 1)],
        build: (v) => ({ type: 'enemy_buff_stacks_below', buffId: String(v.buffId), maxStacks: Number(v.maxStacks) }),
    },
    {
        type: 'buff_not_active',
        label: '自身无某状态',
        params: [buffParam('状态')],
        build: (v) => ({ type: 'buff_not_active', buffId: String(v.buffId) }),
    },
    {
        type: 'debuff_not_active',
        label: '目标无某状态',
        params: [buffParam('状态')],
        build: (v) => ({ type: 'debuff_not_active', buffId: String(v.buffId) }),
    },
    {
        type: 'no_buff_with_tag',
        label: '自身无某类状态',
        params: [tagParam('类别', 'stance')],
        build: (v) => ({ type: 'no_buff_with_tag', tag: String(v.tag) }),
    },
    {
        type: 'time_above',
        label: '交手时间超过',
        params: [num('seconds', '秒数', 20, 1, 300, 5, '秒')],
        build: (v) => ({ type: 'time_above', seconds: Number(v.seconds) }),
    },
]

/** 按类型名取结构化条件定义 */
export function getConditionType(type: RequiredCondition['type']): ConditionTypeDef | undefined {
    return CONDITION_TYPES.find((t) => t.type === canonicalConditionType(type))
}

/**
 * 同义条件类型归并：预设表里有、但结构化表里合并成一个的类型。
 * `enemy_buff_not_active` 与 `debuff_not_active` 判定完全一致，编辑器统一按后者处理。
 */
const CONDITION_TYPE_ALIAS: Partial<Record<RequiredCondition['type'], RequiredCondition['type']>> = {
    enemy_buff_not_active: 'debuff_not_active',
}

/** 编辑器用规范类型名（同义类型归并后的结果） */
export function canonicalConditionType(type: RequiredCondition['type']): RequiredCondition['type'] {
    return CONDITION_TYPE_ALIAS[type] ?? type
}

/** 类型的默认参数值（编辑器打开时回填） */
export function defaultParams(t: ConditionTypeDef): Record<string, number | string> {
    const out: Record<string, number | string> = {}
    for (const p of t.params) out[p.key] = p.default
    return out
}

/** 从已存条件反推编辑参数（用于编辑器回填）；类型不在表内时返回 undefined */
export function conditionParams(c: RequiredCondition): Record<string, number | string> | undefined {
    switch (c.type) {
        case 'always':
            return {}
        case 'hp_below':
        case 'hp_above':
        case 'enemy_hp_below':
        case 'enemy_hp_above':
            return { pct: Math.round(c.ratio * 100) }
        case 'chan_above':
        case 'chan_below':
        case 'ap_above':
        case 'ap_below':
            return { value: c.value }
        case 'distance_less_than':
        case 'distance_greater_than':
            return { meters: c.meters }
        case 'distance_between':
            return { min: c.min, max: c.max }
        case 'buff_stacks_above':
        case 'enemy_buff_stacks_above':
            return { buffId: c.buffId, minStacks: c.minStacks }
        case 'buff_stacks_below':
        case 'enemy_buff_stacks_below':
            return { buffId: c.buffId, maxStacks: c.maxStacks }
        case 'buff_not_active':
        case 'debuff_not_active':
        case 'enemy_buff_not_active':
            return { buffId: c.buffId }
        case 'no_buff_with_tag':
            return { tag: c.tag }
        case 'time_above':
            return { seconds: c.seconds }
    }
}

// ── 状态下拉选项 ──

export interface BuffOption {
    id: string
    name: string
    /** 分组名（optgroup） */
    group: string
}

/** 全部状态（正面/中性 与 异常 分组），供条件编辑器选择 buffId */
export const BUFF_OPTIONS: BuffOption[] = [
    ...BUFF_DB.map((b) => ({ id: b.id, name: b.name, group: '状态' })),
    ...DEBUFF_DB.map((b) => ({ id: b.id, name: b.name, group: '异常' })),
].sort((a, b) => a.group.localeCompare(b.group, 'zh') || a.name.localeCompare(b.name, 'zh'))

/**
 * 状态标签中文名（只覆盖实际出现在状态上的标签，供 "无某类状态" 条件使用）。
 * 不复用 bridge/tagDisplay：data 层不反向依赖 bridge。
 */
const BUFF_TAG_CN: Record<string, string> = {
    buff: '增益',
    chan: '缠劲',
    craft: '奇门',
    debuff: '异常',
    defense: '防御',
    electric: '雷电',
    heal: '回复',
    heavy_reduce: '重减伤',
    imperial: '御物',
    implant: '义体',
    low_hp: '残血',
    poison: '毒',
    qi: '炁',
    slash: '劈砍',
    stance: '架势',
    summon: '召唤',
    super_armor: '霸体',
    weapon: '兵器',
}

/** 状态标签选项（取自状态库实际用到的标签） */
export const BUFF_TAG_OPTIONS: { id: string; name: string }[] = (() => {
    const ids = new Set<string>()
    for (const b of [...BUFF_DB, ...DEBUFF_DB]) for (const t of b.tags) ids.add(t)
    return [...ids].map((id) => ({ id, name: BUFF_TAG_CN[id] ?? id })).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
})()

// ── 描述 ──

/** 必要条件显示描述（含参数） */
export function describeCondition(c: RequiredCondition): string {
    const buffName = (id: string) => getBuff(id)?.name ?? id
    switch (c.type) {
        case 'always':
            return '不设条件'
        case 'debuff_not_active':
            return `目标无 [${buffName(c.buffId)}]`
        case 'buff_not_active':
            return `自身无 [${buffName(c.buffId)}]`
        case 'buff_stacks_below':
            return `自身 [${buffName(c.buffId)}] < ${c.maxStacks}层`
        case 'buff_stacks_above':
            return `自身 [${buffName(c.buffId)}] ≥ ${c.minStacks}层`
        case 'hp_below':
            return `气血 < ${Math.round(c.ratio * 100)}%`
        case 'hp_above':
            return `气血 > ${Math.round(c.ratio * 100)}%`
        case 'distance_less_than':
            return `距离 < ${c.meters}m`
        case 'distance_greater_than':
            return `距离 > ${c.meters}m`
        case 'distance_between':
            return `距离 ${c.min}~${c.max}m`
        case 'enemy_hp_below':
            return `目标气血 < ${Math.round(c.ratio * 100)}%`
        case 'enemy_hp_above':
            return `目标气血 > ${Math.round(c.ratio * 100)}%`
        case 'enemy_buff_not_active':
            return `目标无 [${buffName(c.buffId)}]`
        case 'enemy_buff_stacks_below':
            return `目标 [${buffName(c.buffId)}] < ${c.maxStacks}层`
        case 'enemy_buff_stacks_above':
            return `目标 [${buffName(c.buffId)}] ≥ ${c.minStacks}层`
        case 'no_buff_with_tag':
            return `无 [${BUFF_TAG_CN[c.tag] ?? c.tag}] 类状态`
        case 'chan_above':
            return `缠劲 ≥ ${c.value}`
        case 'chan_below':
            return `缠劲 < ${c.value}`
        case 'ap_above':
            return `内息 ≥ ${c.value}`
        case 'ap_below':
            return `内息 < ${c.value}`
        case 'time_above':
            return `交手 ≥ ${c.seconds}秒`
    }
}

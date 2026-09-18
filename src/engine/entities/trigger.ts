import type { Character } from './character'
import type { EffectDef } from './action'
import type { BattleEngine } from '../combat/engine'

/** 触发时机（EventBus 事件） */
export type TriggerEvent =
    | 'on_attack'
    | 'on_hit'
    | 'on_summon_hit'
    | 'on_was_crit'
    | 'on_dealt_damage'
    | 'on_was_hit'
    | 'on_took_damage'
    | 'on_dodge'
    | 'on_parry'
    | 'on_dodged'
    | 'on_parried'
    | 'on_buff'
    | 'on_stance'
    | 'on_debuff'
    | 'on_poison'
    | 'on_burn'
    | 'on_bleed'
    | 'on_stun'
    | 'on_paralyze'
    | 'on_sand_blind'
    | 'on_disarm'
    | 'on_disarmed'
    | 'on_move_closer'
    | 'on_move_away'
    | 'on_opponent_move_closer'
    | 'on_opponent_move_away'
    | 'on_weapon_change'
    | 'on_turn_start'
    | 'on_turn_end'
    | 'hp_below'
    | 'battle_start'
    | 'on_crit'
    | 'chan_overflow'
    | 'on_action_trigger'
    /** 构造期（内部时机）：源的顶层 effects 迁移后的载体，只在 Character 构造时读一次，运行时永不派发 */
    | 'on_construct'

/** 触发条件上下文 */
export interface ConditionContext {
    actor: Character
    distance: number
    /** 移动事件的位移量（负=靠近，正=远离） */
    moveDelta?: number
    engine?: BattleEngine
    /** 触发事件的 buffId（仅 on_buff 事件） */
    buffId?: string
}

/** 触发条件 */
export interface Condition {
    type: TriggerEvent
    /** 仅当触发事件匹配此 buffId 时生效（on_buff 专用） */
    buffId?: string
    check?: (ctx: ConditionContext) => boolean
}

/**
 * 触发条件表里的一条（数据层声明；玩家可选的会进构筑面板的触发槽下拉）。
 * 触发招式的次数/AP 上限由**招式自身**决定（`ActionDefinition.maxUses`、`apCost > 2` 不进触发），
 * 所以这里不挂次数/费用字段。
 */
export interface TriggerCondition extends Condition {
    id: string
    /**
     * 内部种类：只给数据/引擎用，不进玩家的触发槽下拉（与招式的 `internal` 标签同一口径）。
     * 用法见 src/data/triggers.ts 的 SELECTABLE_TRIGGER_CONDITIONS。
     */
    internal?: boolean
}

/**
 * 一条「时机 → 效果」槽（`EffectSlot`）。
 *
 * 数据里的源（功法/天赋/奇物/武器）与玩家构筑的触发槽都用它：`condition` 是时机，
 * `actionId`（执行一个招式）或 `apply`（直接施加一组效果）是效果本体。
 */
export interface EffectSlot {
    condition: Condition
    actionId?: string
    /** 内联效果（优先于 actionId） */
    apply?: EffectDef[]
}

/**
 * 构造期时机（内部）。
 *
 * 源（功法/天赋/奇物/武器）过去把「构造期贡献」直接写成顶层 `effects:[add_buff]`；现在统一挂到
 * 一条 `condition.type === 'on_construct'` 的槽下 —— 源上只剩 `effects` 一个列表：
 * 时机（含构造期这个内部时机）→ 效果本体。
 */
export const CONSTRUCT_TRIGGER = 'on_construct'

/** 是否构造期槽（内部时机）：运行时永不派发，只由 `constructEffectsOf` 在构造期取用 */
export function isConstructSlot(slot: EffectSlot): boolean {
    return slot.condition.type === CONSTRUCT_TRIGGER
}

/**
 * 取出一个源的**构造期 effects**：按 `on_construct` 槽的声明顺序拼接各槽的 `apply`。
 *
 * 这是「源顶层 effects」迁移后的唯一读取点，顺序语义与旧顶层 effects 数组完全等价
 * （槽顺序 × 槽内声明顺序）。构造期贡献一律由 `buildSourceLayer` 从这些 `add_buff` 派生。
 */
export function constructEffectsOf(source: { effects?: readonly EffectSlot[] }): EffectDef[] {
    const out: EffectDef[] = []
    for (const slot of source.effects ?? []) {
        if (!isConstructSlot(slot)) continue
        out.push(...(slot.apply ?? []))
    }
    return out
}

/** 取出一个源的**运行时槽**（排除构造期 `on_construct`）：进 `passiveTriggers` / 参与运行时派发 */
export function runtimeSlotsOf(source: { effects?: readonly EffectSlot[] }): EffectSlot[] {
    return (source.effects ?? []).filter((slot) => !isConstructSlot(slot))
}


/** 计算触发槽数: max(1, floor(wisdom/4)) */
export function calcTriggerSlots(wisdom: number): number {
    return Math.max(1, Math.floor(wisdom / 4))
}

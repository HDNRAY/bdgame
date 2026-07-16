import type { GameEntity } from '../../engine/entities/base'
import type { AttrName } from '../../engine/entities/attributes'
import type { Character } from '../../engine/entities/character'
import type { BattleEngine } from '../../engine/combat/engine'
import type { BattleState, BuffLayer } from '../../engine/combat/types'
import type { TriggerEvent } from '../../engine/entities/trigger'

/** Buff 钩子上下文 */
export interface BuffHookCtx {
    final: number
    raw: number
    target: Character
    attacker: Character
    engine?: BattleEngine
    state: BattleState
    layer: BuffLayer
    /** 该 buff 所属角色 ID */
    // buffOwnerId: string
    /** 伤害来源（招式/buff/效果），携带正确的 tags */
    source?: GameEntity
    /** 是否为触发招式执行的伤害 */
    triggered?: boolean
}

/** 消耗方式 */
export type BuffExpiry =
    | { type: 'duration'; ms: number }
    | { type: 'duration_by_attr'; attr: AttrName; multiplier: number }
    | { type: 'attr_mult'; attr: AttrName; multiplier: number }
    | { type: 'tick'; interval: number }
    | { type: 'trigger'; event: string }
    | { type: 'consumed'; trigger: TriggerEvent }
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
    /** 每层最大 AP 修正 */
    maxApMod?: number
    /** DOT/tick 间隔（ms） */
    tickInterval?: number
    /** tick 伤害回调 */
    onTickDamage?: (ctx: BuffHookCtx) => number
    /** tick 回复回调 */
    onTickHeal?: (ctx: BuffHookCtx) => number
    /** 攻击伤害修正（buff 持有者造成伤害时调用） */
    onDealDamage?: (ctx: BuffHookCtx) => number | { normal: number; piercing: number }
    /** 造成伤害后追加独立伤害（返回 >0 则额外调 applyBonusDamage） */
    onAfterDealDamage?: (ctx: BuffHookCtx) => number | { normal: number; piercing: number }
    /** 受击伤害修正（buff 持有者受到伤害时调用） */
    onTakeDamage?: (ctx: BuffHookCtx) => number
    /** 层数变更前回调（返回实际 delta，0=拦截变更） */
    onBeforeModify?: (delta: number, ctx: { character: Character; engine: BattleEngine }) => number
    /** 招架率修正钩子（applyDamage 招架判定前自动调用，返回加算值） */
    onParryChance?: (ctx: BuffHookCtx) => number
    /** 招架减伤修正钩子（防御方 buff，applyDamage 招架成功后自动调用） */
    onParryReduction?: (ctx: BuffHookCtx) => number
    /** 招架穿透修正钩子（攻击方 buff，削弱对方招架减伤） */
    onParryPenetration?: (ctx: BuffHookCtx) => number
    /** 命中率修正钩子（processHitCheck 中自动调用，返回加算值） */
    onHitChance?: (ctx: BuffHookCtx) => number
    /** 闪避率修正钩子（processHitCheck 中防御方 buff 自动调用，返回加算值） */
    onDodgeChance?: (ctx: BuffHookCtx) => number
    /** AP 消耗修正钩子（返回加算值，负=更省，最低1） */
    onActionCost?: (ctx: BuffHookCtx) => number
    /** 出招回调（释放任何招式时调用，不受命中影响） */
    onAction?: (ctx: BuffHookCtx) => void
    /** 闪避时回调（防御方成功闪避后调用） */
    onDodged?: (ctx: BuffHookCtx) => void
    /** 招架时回调（防御方成功招架后调用） */
    onParried?: (ctx: BuffHookCtx) => void
    /** 暴击时回调（攻击方造成暴击后调用） */
    onCritical?: (ctx: BuffHookCtx) => void
    /** 允许自行选择可招架（返回 true 则允许招架） */
    onCanParry?: (ctx: { self: Character; engine: BattleEngine }) => boolean
    /** 攻击方能否被招架（返回 false 则无法招架此攻击） */
    onCanBeParried?: (ctx: { self: Character; engine: BattleEngine }) => boolean
    /** 缴械概率修正钩子（disarm handler 中自动调用，返回加算值，负=更难被缴械） */
    onDisarmChance?: (ctx: BuffHookCtx) => number
    /** 暴击率修正钩子（applyDamage 暴击判定前自动调用，遍历攻击方 buff，返回加算值） */
    onCritChance?: (ctx: BuffHookCtx) => number
    /** 降低被暴击率钩子（遍历防御方 buff，返回加算值，负=更难被暴击） */
    onCritTakenChance?: (ctx: BuffHookCtx) => number
    /** 暴击伤害修正钩子（applyDamage 暴击判定时自动调用，返回加算值） */
    onCritDamage?: (ctx: BuffHookCtx) => number
    /** 回合结束回调（turn_end 时调用，不依赖命中） */
    onTurnEnd?: (ctx: BuffHookCtx) => void
    /** 层数上限覆盖钩子（raw=原始 max，返回覆盖后的新上限） */
    onBuffApply?: (raw: number, char: Character, engine: BattleEngine) => number
    /** 收到治疗时回调（所有治疗路径，含 tick heal） */
    onReceiveHeal?: (ctx: BuffHookCtx) => void
    /** 气血变化时回调（任意 hp 变更，含伤害与治疗） */
    onHpChange?: (ctx: BuffHookCtx) => void
    /** debuff 应用回调（首次/叠层时调用，用于设置 extra 数据） */
    onDebuffApply?: (ctx: DebuffApplyCtx) => void
    /** 攻击者施加 debuff 时回调（遍历攻击者身上的 buff 调用） */
    onDebuffApplied?: (ctx: DebuffApplyCtx) => void
    /** 自身受到 debuff 时回调（返回 0=完全抵抗，>0=削减到该层数，undefined=不干预） */
    onReceiveDebuff?: (ctx: ReceiveDebuffCtx) => number | undefined
    /** 额外攻击钩子（返回额外攻击次数，AI 自动循环调用 pickBestSecondary） */
    getExtraAttack?: (ctx: { source: GameEntity }) => number
    /** 自定义日志格式（覆盖默认的"获得状态"消息，返回整个消息体，不含 [BuffName] 前缀） */
    logFormat?: (layer: BuffLayer, targetName: string) => string | undefined
}

/** onDebuffApply 钩子上下文 */
export interface DebuffApplyCtx {
    self: Character
    enemy: Character
    engine: BattleEngine
    stacks: number
    layer: BuffLayer
    /** 被应用的 debuff ID */
    debuffId?: string
}

/** onReceiveDebuff 钩子上下文 */
export interface ReceiveDebuffCtx {
    self: Character
    enemy: Character
    engine: BattleEngine
    buffId: string
    stacks: number
}

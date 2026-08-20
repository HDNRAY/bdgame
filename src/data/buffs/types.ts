import type { GameEntity } from '../../engine/entities/base'
import type { AttrName } from '../../engine/entities/attributes'
import type { Character } from '../../engine/entities/character'
import type { BattleEngine } from '../../engine/combat/engine'
import type { BattleState, BuffLayer } from '../../engine/combat/types'
import type { TriggerEvent } from '../../engine/entities/trigger'

/** 运行时招式的最小接口（供 onRuntimeAction 使用） */
export interface RuntimeAction {
    tags: import('../../engine/entities/tag').Tag[]
    getRange?(weaponRange: [number, number], self?: Character): [number, number]
}

import type { ActionDefinition } from '../../engine/entities/action'
export { type ActionDefinition }

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
    /** 消耗方式 */
    expiry?: BuffExpiry
    /** 叠层行为 */
    stacking?: BuffStacking
    /** 同类型钩子处理优先级（默认 0，越小越先执行；用于 onAfterCritDamage 等「返回全量覆盖」钩子，保证某 buff 最后/最先处理） */
    priority?: number
    /** 每层属性修正 */
    attrMods?: Record<string, number>
    /** 每层最大 AP 修正 */
    maxApMod?: number
    /** DOT/tick 间隔（ms） */
    tickInterval?: number
    /** 每秒额外 AP 回复量（用于 recalcRegenDelay 估算回满时间；返回 0 表示不贡献） */
    apRegenPerSec?: (ctx: BuffHookCtx) => number
    /** 每秒额外缠劲回复量（由引擎统一 regen_tick 发放；返回 0 表示不贡献） */
    chanRegenPerSec?: (ctx: BuffHookCtx) => number
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
    /** 移动效率修正钩子（返回加算值，0.1 = +10% 每AP移动距离；buff 持有者移动时调用） */
    onMoveEfficiency?: (ctx: BuffHookCtx) => number
    /** 召唤物回合间隔钩子（返回前后摇乘数，<1=加速；御物加速等用） */
    onSummonInterval?: (ctx: BuffHookCtx) => number
    /** 出招回调（释放任何招式时调用，不受命中影响） */
    onAction?: (ctx: BuffHookCtx) => void
    /** 闪避时回调（防御方成功闪避后调用） */
    onDodged?: (ctx: BuffHookCtx) => void
    /** 招架时回调（防御方成功招架后调用） */
    onParried?: (ctx: BuffHookCtx) => void
    /** 暴击时回调（攻击方造成暴击后调用） */
    onCritical?: (ctx: BuffHookCtx) => void
    /** DOT tick 时回调（遍历目标身上所有有 onDebuffTick 的 buff 调用，可修改 damage） */
    onDebuffTick?: (ctx: DebuffTickCtx) => number | undefined
    /** 允许自行选择可招架（返回 true 则允许招架） */
    onCanParry?: (ctx: { self: Character; engine: BattleEngine }) => boolean
    /** 攻击方能否被招架（返回 false 则无法招架此攻击） */
    onCanBeParried?: (ctx: { self: Character; engine: BattleEngine; source?: ActionDefinition }) => boolean
    /** 缴械概率修正钩子（disarm handler 中自动调用，返回加算值，负=更难被缴械） */
    onDisarmChance?: (ctx: BuffHookCtx) => number
    /** 暴击率修正钩子（applyDamage 暴击判定前自动调用，遍历攻击方 buff，返回加算值） */
    onCritChance?: (ctx: BuffHookCtx) => number
    /** 降低被暴击率钩子（遍历防御方 buff，返回加算值，负=更难被暴击） */
    onCritTakenChance?: (ctx: BuffHookCtx) => number
    /** 降低被暴击伤害钩子（遍历防御方 buff，返回加算值，负=更难被暴击伤害，如 -0.5 = 爆伤从 1.5 降到 1.0） */
    onCritTakenDamage?: (ctx: BuffHookCtx) => number
    /** 暴击伤害修正钩子（applyDamage 暴击判定时自动调用，返回加算值） */
    onCritDamage?: (ctx: BuffHookCtx) => number
    /** 暴击伤害后钩子（计算完爆伤后、实施伤害前调用，返回本次暴击应造成的完整伤害量，引擎以该值覆盖；返回 damage 保留非暴击部分，返回 0 完全转为其他效果）。多个此类钩子按 priority 升序链式执行，priority 大者最后，可读取前序结算后的 final。 */
    onAfterCritDamage?: (ctx: AfterCritDamageCtx) => number
    /** 回合结束回调（turn_end 时调用，不依赖命中） */
    onTurnEnd?: (ctx: BuffHookCtx) => void
    /** 层数上限覆盖钩子（raw=原始 max，返回覆盖后的新上限） */
    onBuffApply?: (raw: number, char: Character, engine: BattleEngine) => number
    /** buff/debuff 首次建层后回调（一次性初始化 extra/层数据；叠层不触发） */
    onBuffApplied?: (ctx: BuffAppliedCtx) => void
    /** 自身任意可叠层（additive）buff 叠层时回调（返回实际允许新增的层数，0=拦截叠层；可用于扣资源） */
    onStackGain?: (ctx: StackGainCtx) => number
    /** 收到治疗时回调（所有治疗路径，含 tick heal） */
    onReceiveHeal?: (ctx: BuffHookCtx) => void
    /** 气血变化时回调（任意 hp 变更，含伤害与治疗） */
    onHpChange?: (ctx: BuffHookCtx) => void
    /** debuff 应用回调（首次/叠层时调用，用于设置 extra 数据） */
    onDebuffApply?: (ctx: DebuffApplyCtx) => void
    /** 攻击者施加 debuff 时回调（遍历攻击者身上的 buff 调用） */
    onDebuffApplied?: (ctx: DebuffApplyCtx) => void
    /** 自身受到 debuff 时回调（返回 0=完全抵抗，>0=削减到该层数，undefined=不干预） */
    onReceiveDebuff?: (ctx: DebuffApplyCtx) => number | undefined
    /** 运行时招式修正（每次 getRuntimeAction 时链式调用，可用于改 tags/range 等） */
    onRuntimeAction?: (ctx: BuffHookCtx, action: RuntimeAction) => RuntimeAction
    /** 额外攻击钩子（返回额外攻击次数，AI 自动循环调用 pickBestSecondary） */
    getExtraAttack?: (ctx: { source: GameEntity }) => number
    /** 自定义日志格式（覆盖默认的"获得状态"消息，返回整个消息体，不含 [BuffName] 前缀） */
    logFormat?: (layer: BuffLayer, targetName: string) => string | undefined
    /** 触发招式判定钩子（返回 false 则本次触发招式不执行；attacker=触发者，target=目标，source=触发招式，可自由做条件，如觉醒后不再触发） */
    canTriggerAction?: (ctx: BuffHookCtx) => boolean
}

/** onBuffApplied 钩子上下文（首次建层后调用） */
export interface BuffAppliedCtx {
    /** buff 持有者（add_buff=self，add_debuff=enemy） */
    self: Character
    engine: BattleEngine
    /** 战斗状态 */
    state: BattleState
    /** 本次层数据（restoreValue=层数/档位） */
    layer: BuffLayer
    buffId: string
}

/** debuff 事件上下文（onDebuffApply / onDebuffApplied / onReceiveDebuff 共用） */
export interface DebuffApplyCtx {
    self: Character
    enemy: Character
    /** 引擎（AI 估算等无引擎上下文下可省略；副作用型钩子如十香软筋散因 !engine 自动跳过） */
    engine?: BattleEngine
    /** 战斗状态（AI 估算时为克隆的 safeState） */
    state: BattleState
    /** 本次 debuff 层数 */
    stacks: number
    /** debuff ID */
    buffId: string
    /** debuff 的层数据（onReceiveDebuff 在施加前调用，无 layer） */
    layer?: BuffLayer
}

/** onStackGain 钩子上下文 */
export interface StackGainCtx {
    /** 叠层 buff 持有者 */
    char: Character
    /** 正在叠层的 buff ID */
    buffId: string
    /** 本次新增层数（已按上限截断，钩子可改为更小值） */
    delta: number
    engine: BattleEngine
}

/** DOT tick 回调上下文（onDebuffTick） */
export interface DebuffTickCtx {
    /** 正在 tick 的 DOT debuff ID（'burn'/'poison'/'bleed'） */
    buffId: string
    /** 受害者 */
    target: Character
    /** 本次 tick 的原始伤害值（可修改） */
    damage: number
    /** 引擎（AI 估算等无引擎上下文下可省略；现有钩子均不依赖） */
    engine?: BattleEngine
    /** DOT 的 buff 层数据 */
    layer: BuffLayer
}

/** onAfterCritDamage 钩子上下文 */
export interface AfterCritDamageCtx extends BuffHookCtx {
    /** 暴击加成前的伤害（招架后 + 破甲穿透） */
    damage: number
    /** 暴击加成后的完整伤害 */
    critDamage: number
    /** 当前覆盖值：多钩子链式时传入上一钩子返回的全量，首个等于 critDamage（继承自 BuffHookCtx.final） */
}

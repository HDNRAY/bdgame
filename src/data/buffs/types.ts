import type { GameEntity } from '../../engine/entities/base'
import type { AttrName } from '../../engine/entities/attributes'
import type { Character } from '../../engine/entities/character'
import type { BattleEngine } from '../../engine/combat/engine'
import type { BattleState, BuffLayer } from '../../engine/combat/types'
import type { TriggerEvent } from '../../engine/entities/trigger'
import type { Tag } from '../../engine/entities/tag'
import type { StatRestrictionCheck } from '../../engine/entities/character/source-layer'

/** 运行时招式的最小接口（供 onRuntimeAction 使用） */
export interface RuntimeAction {
    tags: Tag[]
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
    /** 本次实际扣除的 AP（onAction 钩子提供；其余回调恒为 undefined） */
    apCost?: number
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

/** 叠层行为：
 *  - none：同一次施加的 stacks 生效（可 >1），已存在则幂等跳过（不叠不刷新）
 *  - single：与 none 行为一致，但语义表达「同一次可多层、跨次不叠」——单次施加即完整效果，
 *    已存在时再次施加完全忽略（用于迷眼类：一次撒沙叠 N 层，已迷眼不再加深/刷新）
 *  - additive：可跨次叠加（restoreValue 累计、时长刷新）
 *  - independent：每层独立 key（各自计时/独立 attrMods） */
export type BuffStacking =
    | { type: 'none' }
    | { type: 'single' }
    | { type: 'additive'; max?: number }
    | { type: 'independent' }

/** Buff 定义 */
export interface BuffDef extends GameEntity {
    /** 消耗方式 */
    expiry?: BuffExpiry
    /** 叠层行为 */
    stacking?: BuffStacking
    /** 同类型钩子处理优先级（默认 0，越小越先执行；用于 onAfterCritDamage 等「返回全量覆盖」钩子，保证某 buff 最后/最先处理） */
    priority?: number
    /**
     * 每层属性修正。
     *
     * 由**来源顶层 `effects:[add_buff]`** 挂上的 buff（附着 buff），其 `attrMods × stacks`
     * 在构造期就折进 `Character` 的来源层账，战斗界面/构筑面板/触发槽/血量/武器门槛全部按它算。
     */
    attrMods?: Record<string, number>
    /**
     * 每层最大气血修正。
     *
     * 由**来源顶层 `effects:[add_buff]`** 挂上的附着 buff，其 `maxHpMod × stacks` 在构造期折进
     * `SourceLayer.maxHpMod`（`Character.rebuildDerived` 汇总成 `char.maxHpMod`）—— 与 `attrMods` 同口径。
     */
    maxHpMod?: number
    /**
     * 构造期额外触发槽（附着 buff 专用）。
     *
     * 与 `triggerSlotModFn` 二选一：静态值优先（`triggerSlotMod ?? triggerSlotModFn(char)`），
     * 在建来源层那一刻求值一次，折进 `SourceLayer.triggerSlotMod`。
     */
    triggerSlotMod?: number
    /** 构造期触发槽的**动态**版本（每 N 点洞察 +1 之类）；求值时机与旧的 `trigger_slot_mod.fn(char)` 相同 */
    triggerSlotModFn?: (char: Character) => number
    /**
     * 构造期属性转化（按声明顺序回放）：`floor(from × ratio)` 加到 `to` 上。取整口径只有一个（`convertAttrAmount`），不要在数据里再分 round/floor。
     *
     * 折成 `SourceLayer` 的 `convert` op，位置 = 该附着 buff 在 effects 里的位置（保序，限制器只拦后面的）。
     */
    attrConvert?: { from: AttrName; to: AttrName[]; ratio: number }[]
    /** 构造期给主手武器补的标签（如玄剑秘册的 `unarmed`） */
    weaponTags?: Tag[]
    /**
     * 构造期增益时长倍率（炁蕴绵长：每点推演 +5%）。
     *
     * 折进 `SourceLayer.durationMults`，调用时机与旧的 `buff_duration_mult.eval(char)` 相同（乘算）。
     */
    buffDurationFn?: (char: Character) => number
    /**
     * 构造期属性限制回调（迷眼减半 / 属性下限等），折成 `SourceLayer` 的 `restriction` op。
     *
     * 与旧的 `stat_restriction` 同一套语义：**注册后**才拦后续 mod，回调在回放到该位置时被调用。
     */
    statRestriction?: StatRestrictionCheck
    /**
     * 不进战斗界面 buff 列表（纯内部标记用，如 `iaijutsu_ready_buff`）。
     *
     * 只管**展示口径**，与「是否建运行时层」无关（建层判据见 `needsLayer` 与
     * `needsRuntimeLayer`）。纯属性附着 buff 现在会显示（账上补进列表），但仍不建层。
     */
    hidden?: boolean
    /**
     * 显式声明「需要运行时层」，即使这条 buff 没有任何钩子/时长/叠层/maxApMod/tick/回复率。
     *
     * 用于无钩子但被引擎按 `pendingBuffs` 探测（`min_move_cost`）或会被 `remove_buff` 消耗
     * （`sangui_yuanqi`、`muscle_degradation` 物化时还要打「获得状态」日志）的附着 buff ——
     * 它们没有别的运行时特征，只能由数据显式声明。建层判据见
     * `needsRuntimeLayer`（src/engine/entities/character/source-layer.ts）。
     */
    needsLayer?: boolean
    /**
     * 附着 buff 物化成战斗层时触发一次（恒有 engine/state）。
     *
     * 用例：`attrMods` 表达不了的"生效时刻行为" —— 例如居合精通要在开局触发一招
     * （原来是 `battle_start → actionId` 的触发槽）。
     */
    onActivate?: (ctx: BuffHookCtx) => void
    /** 每层最大 AP 修正（由 `applyMaxApMod` 写进战斗层账，删层时 `dropBuffLayer` 精确回退）。
     *  顶层 `effects:[add_buff]` 上的此类载体（`isApOnlyCarrier`）在开局物化，等价于旧的
     *  `battle_start → max_ap_mod` 槽。 */
    maxApMod?: number
    /** DOT/tick 间隔（ms） */
    tickInterval?: number
    /** 每秒额外 AP 回复量（用于 recalcRegenDelay 估算回满时间；返回 0 表示不贡献） */
    apRegenPerSec?: (ctx: BuffHookCtx) => number
    /** 每秒额外缠劲回复量（由引擎统一 regen_tick 发放；返回 0 表示不贡献） */
    chanRegenPerSec?: (ctx: BuffHookCtx) => number
    /** 缠劲回复溢出回调（缠达到上限后继续回复被截断的量，传入 overflow 实际溢出值；周流不息等溢出转化 buff 用） */
    onChanOverflow?: (ctx: BuffHookCtx & { overflow: number }) => void
    /** tick 伤害回调 */
    onTickDamage?: (ctx: BuffHookCtx) => number
    /** tick 回复回调 */
    onTickHeal?: (ctx: BuffHookCtx) => number
    /** 攻击伤害修正（buff 持有者造成伤害时调用） */
    onDealDamage?: (ctx: BuffHookCtx) => number | { normal: number; piercing: number }
    /**
     * 造成伤害后追加独立伤害（返回 >0 则额外调 applyBonusDamage）。
     *
     * 返回对象时**与 `onPostCritDamage` / `onDealDamage` 同口径**：`normal` 是这次追加的**总额**，
     * `piercing` 是其中"无视减免"的那部分（穿透 = 结算方式，不是额外一笔）——
     * 写 `{ normal: 2, piercing: 1 }` 就是"共追 2 点，其中 1 点必进"，不是"1 点普通 + 1 点穿透"。
     */
    onAfterDealDamage?: (ctx: BuffHookCtx) => number | { normal: number; piercing: number }
    /** 受击伤害修正（buff 持有者受到伤害时调用；减伤阶段，招架后结算，含反伤/回缠类） */
    onTakeDamage?: (ctx: BuffHookCtx) => number
    /** 护盾吸收（buff 持有者受到伤害时调用；吸收阶段，减伤后、最终扣血前结算。金钟罩/炁盾/能量护盾等护盾池专用） */
    onAbsorb?: (ctx: BuffHookCtx) => number
    /** 招架率修正钩子（applyDamage 招架判定前自动调用，返回加算值） */
    onParryChance?: (ctx: BuffHookCtx) => number
    /** 招架减伤修正钩子（防御方 buff，applyDamage 招架成功后自动调用） */
    onParryReduction?: (ctx: BuffHookCtx) => number
    /** 招架穿透修正钩子（攻击方 buff，削弱对方招架减伤）。返回「本次穿掉的伤害值」(>=0)，
     *  引擎将多个穿透返回值相加后 clamp 到最多把招架段减免穿干净(blocked)，不会穿成负数；
     *  不作用于⑤段减伤/吸收(onTakeDamage/onAbsorb)。ctx.final = 防御方 onParryReduction 结算后的伤害。 */
    onParryPenetration?: (ctx: BuffHookCtx) => number
    /** 命中率修正钩子（processHitCheck 中自动调用，返回加算值） */
    onHitChance?: (ctx: BuffHookCtx) => number
    /** 闪避率修正钩子（processHitCheck 中防御方 buff 自动调用，返回加算值） */
    onDodgeChance?: (ctx: BuffHookCtx) => number
    /** AP 消耗修正钩子（返回加算值，负=更省，最低1） */
    onActionCost?: (ctx: BuffHookCtx) => number
    /**
     * 缠劲消耗修正钩子（返回加算值，负=更省；总消耗 clamp 到 ≥0，0 成本招式保持 0）。
     *
     * 与 `onActionCost` 同构，覆盖主招与前后摇辅助招的 `chanCost`；不覆盖武器/奇物自扣的散点 `spendChan`。
     * 引擎侧与 AI 估算统一走 `calcActionChanCost()` —— 别再各写一份（AP 那边就是散成四份才出的口径漂移）。
     */
    onActionChanCost?: (ctx: BuffHookCtx) => number
    /** AP 成功扣除后的通知钩子 */
    onApSpent?: (ctx: {
        self: Character
        amount: number
        engine: BattleEngine
        state: BattleState
        layer: BuffLayer
    }) => void
    /** 移动效率修正钩子（返回加算值，0.1 = +10% 每AP移动距离；buff 持有者移动时调用） */
    onMoveEfficiency?: (ctx: BuffHookCtx) => number
    /** 急速修正钩子（返回加算值，1 = +1 急速；buff 持有者计算 AP 成本/行动前摇时调用，如追星叠层加速） */
    onHaste?: (ctx: BuffHookCtx) => number
    /** 召唤物回合间隔钩子（返回前后摇乘数，<1=加速；御物加速等用） */
    onSummonInterval?: (ctx: BuffHookCtx) => number
    /** 出招回调（释放任何招式时调用，不受命中影响） */
    onAction?: (ctx: BuffHookCtx) => void
    /** 对方出招回调（对方释放任何招式时调用，不受命中影响；用于看破类效果。ctx.attacker=对方，ctx.target=本 buff 持有者） */
    onOpponentAction?: (ctx: BuffHookCtx) => void
    /** 自己成功闪避回调（防御方闪避成功后调用；遍历防御方 buff，与 trigger on_dodge 同义） */
    onDodge?: (ctx: BuffHookCtx) => void
    /** 自己成功招架回调（防御方招架成功后调用；遍历防御方 buff，与 trigger on_parry 同义） */
    onParry?: (ctx: BuffHookCtx) => void
    /** 对方闪避回调（攻击方出招被闪避后调用；遍历攻击方 buff，与 trigger on_dodged 同义） */
    onDodged?: (ctx: BuffHookCtx) => void
    /** 对方招架回调（攻击方出招被招架后调用；遍历攻击方 buff，与 trigger on_parried 同义） */
    onParried?: (ctx: BuffHookCtx) => void
    /** 暴击时回调（攻击方造成暴击后调用） */
    onCritical?: (ctx: BuffHookCtx) => void
    /** DOT tick 时回调（遍历目标身上所有有 onDebuffTick 的 buff 调用，可修改 damage） */
    onDebuffTick?: (ctx: DebuffTickCtx) => number | undefined
    /** 允许自行选择可招架（返回 true 则允许招架） */
    onCanParry?: (ctx: { self: Character; engine: BattleEngine }) => boolean
    /** 攻击方能否被招架（返回 false 则无法招架此攻击） */
    onCanBeParried?: (ctx: { self: Character; engine: BattleEngine; source?: ActionDefinition; triggered?: boolean }) => boolean
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
    /** 暴击结算后伤害修正钩子（攻击方 buff，暴击/爆伤后、招架/减伤/吸收前调用）：
     *  对含爆伤的最终伤害做修正——返回 number 则整体覆盖该伤害（可增伤/转化），
     *  返回 { normal, piercing } 则把伤害拆成普通+穿透两部分（穿透吃爆伤且无视后续招架/减伤/吸收，如无相、一点破晓类效果）。 */
    onPostCritDamage?: (ctx: BuffHookCtx) => number | { normal: number; piercing: number }
    /** 回合结束回调（on_turn_end 时调用，不依赖命中） */
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
    /**
     * 自定义日志格式（覆盖默认的"获得状态"消息里的描述段，返回消息体，不含 [BuffName]「名字」获得状态 前缀）。
     *
     * 第三个参数是**层持有者**：想让消息带上真实数值（如「附加灵巧×0.04 = 0.4」）就得靠它，
     * 层本身只存层数/额外数据。buff 与 debuff 的建层日志都认它（attach 物化 + add_buff + add_debuff）。
     */
    logFormat?: (layer: BuffLayer, targetName: string, char?: Character) => string | undefined
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
    /**
     * 施加这次 debuff 的招式/效果（`add_debuff` 效果的来源）。
     * 「按实时暴击率触发」的钩子要用它算 `onActionCritChance`（铸火诀/毒药大师）。
     */
    source?: GameEntity
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

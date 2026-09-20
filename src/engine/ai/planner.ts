/**
 * 回合计划生成器：把整个回合（移动 + 招式序列）作为一个计划来枚举和评估。
 *
 * 背景：旧 AI（trySelect）是分步决策——先选主招（当前距离能打就选）、再补连发、
 * 再补移动。每一步只看局部，导致：
 *   1. melee 有远程招（如大津·落月）时，AI 贪"当前能打"站远打低效远程，错过
 *      "落月起手 → 移动贴近 → 近战连发"的高伤害组合。
 *   2. 连发（分心错手/漫天花雨 getExtraAttack）与移动脱节，从不联合规划。
 *   3. 移动目标按风格硬编码（melee 必贴脸），不考虑"省 AP 给连发"。
 *
 * 新模型：对「当前距离 + 由风格意图算出的目标距离」生成「段1(当前位置打) → 移动 → 段2(落点打)」
 * 的完整序列，按 伤害/AP 效率 评估（效率相同取总伤害高者），选最优计划。
 * 移动落点**算出来而不是穷举**：最优射程带（每 AP 期望伤害最高那一档招式的射程并集）
 * 定「站哪一段」，风格意图定「站哪一端」，AP 预算定「这一回合能走多远」，走不满就走到头。
 *
 * 两种形状（进同一套评分里比）：
 * - 先动后打：走到意图目标再出招（当前距离打不到时必须先动）；
 * - 先打后动（后置移动）：在当前距离把招打完，再用剩余 AP 退到意图位置。天外飞仙这类自带
 *   `short_dash` 的冲脸招会把自己拖到贴身，不退开就等于站进对手射程。
 * 计划评估按招式自带位移（short_dash / dash / step_back / knockback）结算**真实落点**，
 * 并用 `positionRuleOk` 把「位置」当规则而不是加分：结束位置必须满足本次意图；走不到目标时
 * 必须把没花在招式上的 AP 全用在朝意图方向移动上 —— 否则 伤害/AP 恒偏好「多打一招、原地不动」。
 */

import type { Character } from '../entities/character'
import type { ActionDefinition, EffectDef } from '../entities/action'
import { getAction, getActionRange, getRuntimeAction } from '../../data/actions'
import type { BattleState, ActionCommand } from '../combat/types'
import { getWeapon } from '../../data/weapons/weapons'
import { forEachHookOf, calcExtraMoveEfficiency } from '../combat/utils'
import { calcActionChanCost } from '../combat/utils/action-cost'
import { PositionSystem } from '../combat/position'
import { calcExpectedDamage, type DamageEstimate } from './expected-damage'
import { chanOpportunityCost, calcChanCostInAp } from '../calc/chan-value'
import { MIN_MOVE_PER_AP } from '../constants'

/** 一个完整的回合计划 */
export interface ActionPlan {
    /** 指令序列（前摇 → 段1招 → 移动 → 段2招 → 收尾移动 → 收招） */
    cmds: ActionCommand[]
    /** 本回合总期望伤害 */
    totalDamage: number
    /** 总 AP 消耗（不含缠；postCmds 剩余 AP 计算依赖纯 AP） */
    totalAp: number
    /** 缠劲消耗折算的 AP 机会成本（既有公式 calcChanCostInAp，一次性按总消耗算） */
    totalChan: number
    /** 评分 = totalDamage / (totalAp + totalChan) */
    score: number
}

/** 一个可施放招式（元数据；伤害按目标距离实时评估） */
interface UsableAction {
    id: string
    def: ActionDefinition
    /** 显式出招优先级（1 起，越小越优先）；0 = 未设 */
    priority: number
    /**
     * 身法/急速减免 + onActionCost 折扣后的 AP 成本（= `calcExpectedDamage().apCost`，与引擎实扣同口径）。
     * 效率排序用它；真正的扣费/预算仍由 `actionCostAt` 按出手顺序重算（分心错手这类"第几招才算"的折扣只有那里知道）。
     */
    baseApCost: number
    /** 缠劲成本（机会成本折算到 AP） */
    chanCostAp: number
    /** 原始缠劲成本（判断当前缠劲是否够） */
    chanCost: number
    /** 招式射程（判断指定距离是否够得到） */
    range: [number, number]
}

/** 单段选招结果 */
interface PickResult {
    actions: UsableAction[]
    totalDamage: number
    totalAp: number
}

/**
 * 从招式池里选招（在 dist 距离能打到的）：**先按显式出招优先级（`ActionConfig.priority`），
 * 再按伤害/AP 效率**。未设优先级的招式排在有优先级的之后（对手数据都没设 → 等价原来的效率比择优）。
 * @param dist 施放时的距离（决定 canReach）
 * @param max 本段最多选几招（连发：1 + getExtraAttack）
 * @param exclude 排除的招式 id（如已用作主招）
 * @param mockLayer 模拟 onActionCost 的局部 layer（firstActionDone 回合级标记，段间共享）
 */
function pickActions(
    self: Character,
    state: BattleState,
    pool: UsableAction[],
    dist: number,
    budget: number,
    max: number,
    exclude: Set<string>,
    mockLayer: { restoreValue: number; extra: Record<string, unknown> },
    evalAt: (dist: number, def: ActionDefinition) => DamageEstimate,
): PickResult {
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return { actions: [], totalDamage: 0, totalAp: 0 }

    // 该距离够得到、缠劲够、未被排除的候选
    const candidates = pool.filter(
        (a) => dist >= a.range[0] && dist <= a.range[1] && self.chan >= a.chanCost && !exclude.has(a.id),
    )
    // 按 dist 实时评估伤害（命中/招架/距离修正随距离变化，不能复用当前距离的评估）
    const scored = candidates
        .map((a) => {
            const est = evalAt(dist, a.def)
            return { a, damage: est.expectedDamage, canReach: est.canReach }
        })
        .filter((x) => x.canReach && x.damage > 0)
        .map((x) => ({ ...x, rate: x.damage / Math.max(1e-9, x.a.baseApCost + x.a.chanCostAp) }))
        .sort((x, y) => {
            // 显式优先级在前（未设 = 最低档）；同一档内仍按伤害/AP 效率比
            const px = x.a.priority > 0 ? x.a.priority : Number.POSITIVE_INFINITY
            const py = y.a.priority > 0 ? y.a.priority : Number.POSITIVE_INFINITY
            if (px !== py) return px - py
            if (Math.abs(x.rate - y.rate) > 1e-9) return y.rate - x.rate
            return y.damage - x.damage
        })

    const picked: UsableAction[] = []
    let remaining = budget
    let totalDamage = 0
    let totalAp = 0
    // 模拟 onActionCost：分心错手等按「第几招」给减免（第 1 招正常，之后每招 -1 等）。
    // firstActionDone 是回合级标记（onTurnEnd 重置），段1/段2 共享同一 mock layer。
    for (const x of scored) {
        if (picked.length >= max) break
        const cost = actionCostAt(self, state, x.a, mockLayer)
        if (cost > remaining + 1e-9) continue
        picked.push(x.a)
        remaining -= cost
        totalDamage += x.damage
        totalAp += cost
        exclude.add(x.a.id) // 同一招不重复
    }
    return { actions: picked, totalDamage, totalAp }
}

/**
 * 计算第 Nth 招的实际 AP 成本：baseApCost + 所有 onActionCost 钩子加算（最低 1），再走身法减免。
 * mockLayer.extra.firstActionDone 由钩子推进（分心错手：第 2 招起 -1）。
 */
function actionCostAt(
    self: Character,
    state: BattleState,
    a: UsableAction,
    mockLayer: { restoreValue: number; extra: Record<string, unknown> },
): number {
    const enemy = state.characters.find((c) => c.id !== self.id) ?? self
    let cost = a.def.apCost
    forEachHookOf(state.pendingBuffs, 'onActionCost', self.id, (_def, _layer) => {
        // 用 mock layer 代替真实 layer（钩子读写 firstActionDone，避免污染）
        const r = _def.onActionCost?.({
            final: 0,
            raw: 0,
            attacker: self,
            target: enemy,
            state,
            layer: mockLayer as unknown as typeof _layer,
            source: a.def,
        })
        cost = Math.max(1, cost + (r ?? 0))
    })
    return self.actionApCost(cost, state)
}

/** 计算从 from 移动到 to 所需 AP（返回 0 表示不需要移动） */
function moveCost(self: Character, state: BattleState, from: number, to: number): number {
    if (Math.abs(from - to) < 0.05) return 0
    return PositionSystem.moveApFor(Math.abs(from - to), movePerAp(self, state))
}

/** 移动计划：走路或位移招式（虎跃/筋斗/魅影步等） */
interface MovePlan {
    /** 移动指令（move 或 support(dash 招式)） */
    cmd: ActionCommand
    /** 实际 AP 成本（引擎 calcMovement 按 |bestDistance| 收费） */
    apCost: number
    /** 位移招式 id（若有） */
    dashActionId?: string
    /** 实际落点距离（引擎按 perAp×ap 位移，ceil 取整会过冲/欠冲，seg2 按此评估） */
    landDist: number
}

/** 移动每 AP 位移量（与 moveCost/引擎 calcMovement 同源） */
function movePerAp(self: Character, state: BattleState): number {
    const basePerAp = PositionSystem.apToRange(self.attrs.get('agility'))
    return state.pendingBuffs.has(`min_move_cost::${self.id}`)
        ? MIN_MOVE_PER_AP
        : basePerAp * (1 + calcExtraMoveEfficiency(state, self))
}

/**
 * 规划从 from 移动到 to：优先用位移招式（dash），若比走路更省 AP 或走路够不到；
 * 否则走路。dash 落点只需落在 acceptableRange（段2 招式射程）内即可，不必精确等于 to——
 * 否则 big_leap 跳到 0m 但 to=2m 会被误拒。
 * 走路分支：引擎按 bestDistance(AP)×perAp 位移，ceil 取整可能过冲跌破招式射程下限
 * （贴脸 1 → 落 0.94），因此校验真实落点，且返回 landDist 供段2 按实际落点评估。
 */
export function planMove(
    self: Character,
    state: BattleState,
    from: number,
    to: number,
    apBudget: number,
    acceptableRange?: [number, number],
): MovePlan | null {
    if (Math.abs(from - to) < 0.05) return null
    // 每 AP 位移量只算一次（moveCost 与走路分支共用）
    const perAp = movePerAp(self, state)
    const walkAp = moveCost(self, state, from, to)

    // 遍历位移招式（dash/short_dash），找一个能接近目标且更省 AP 的
    // getMaxActionRange 缓存（dash 目标距离，遍历期间可能多次用到）
    let cachedMaxRange: number | null = null
    let bestDash: MovePlan | null = null
    for (const inst of self.actions) {
        const dashEff = inst.def.effects?.find((e): e is Extract<EffectDef, { type: 'dash' }> => e.type === 'dash')
        if (!dashEff) continue
        if (inst.def.chanCost && self.chan < calcActionChanCost(state, self, inst.def)) continue
        if (inst.def.canUse && !inst.def.canUse(self, state)) continue
        const { minRange = 0, maxRange = Infinity, targetDist: rawTarget } = dashEff
        const targetDist = rawTarget < 0 ? (cachedMaxRange ??= self.getMaxActionRange(state)) : rawTarget
        if (targetDist < 0) continue
        const desired = from - targetDist // 正=靠近
        if (Math.abs(desired) < minRange) continue
        const travel = Math.sign(desired) * Math.min(Math.abs(desired), maxRange)
        if (travel === 0) continue
        const landDist = from - travel
        // 落点需在可接受区间内（默认目标 ±0.6；有射程则落入射程即可，避免 big_leap 贴脸被误拒）
        const inRange = acceptableRange
            ? landDist >= acceptableRange[0] - 0.01 && landDist <= acceptableRange[1] + 0.01
            : Math.abs(landDist - to) <= 0.6
        if (!inRange) continue
        // 位移落点还必须「不比原地更远离本次意图目标」：凤迴(落 0)/凤反(落最大射程) 这类
        // 目标距离写死的位移招，只按「落点在可打区间内」判定会把意图做反
        // （意图拉开却被瞬移贴脸，且位移只要 1 AP，比走路便宜得多）。
        if (Math.abs(landDist - to) > Math.abs(from - to) + 0.01) continue
        const dashAp = dashEff.useAp
            ? Math.max(1, Math.ceil(Math.abs(travel) * 0.4))
            : self.actionApCost(inst.apCost, state)
        if (dashAp > apBudget) continue
        // dash 更省 AP（比走路省 ≥0.5）才采用；否则走路更稳
        if (walkAp <= dashAp + 0.5) continue
        const isSupport = inst.def.tags.includes('pre_action') || inst.def.tags.includes('post_action')
        bestDash = {
            cmd: isSupport ? { type: 'support', actionId: inst.id } : { type: 'attack', actionId: inst.id },
            apCost: dashAp,
            dashActionId: inst.id,
            landDist,
        }
        break // 第一个合适的 dash 即最优（按招式顺序）
    }
    if (bestDash) return bestDash

    // 走路：校验真实落点（引擎 perAp×ap 位移，ceil 取整可能过冲跌破射程下限）落在可接受区间内。
    // 落点是确定性的（与引擎同公式），用严格容差：过冲 0.06 就是真的打不到，直接放弃该移动
    const delta = to < from ? -1 : 1
    const landDist = Math.max(0, from + delta * perAp * walkAp)
    if (acceptableRange && (landDist < acceptableRange[0] - 0.01 || landDist > acceptableRange[1] + 0.01)) {
        return null
    }
    if (walkAp > apBudget) return null
    return { cmd: { type: 'move', bestDistance: delta * walkAp }, apCost: walkAp, landDist }
}

/**
 * 召唤物攻击射程下限的最大值（贴脸点不能低于它——三相珠 [1,10] 贴脸 0m 时法珠永远够不到，
 * 而召唤物往往是御物系主输出；贴脸点 = max(本体招下限, 各召唤物下限的最大值) 让本体招与所有召唤物都能打）。
 */
function summonMinRange(self: Character): number | null {
    const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
    let max = -Infinity
    const consider = (sd: { actionId: string; action?: ActionDefinition } | undefined) => {
        if (!sd) return
        const action = sd.action ?? getAction(sd.actionId)
        if (!action) return
        // 召唤物由主手武器（御物）携带，射程基准用主手
        const r = action.getRange?.(weapon.range, self) ?? weapon.range
        max = Math.max(max, r[0])
    }
    consider(weapon.summon)
    for (const art of self.artifactDefs) consider(art.summon)
    return Number.isFinite(max) ? max : null
}

/** 「每 AP 期望伤害」用的评估器（generatePlans 传入带缓存的版本） */
type EvalAt = (dist: number, def: ActionDefinition) => DamageEstimate

/** 速率同档容差：落在这之内视为「一样好的招」，射程并起来算最优带 */
const RATE_TOL = 0.15
/** 目标距离离带边界留的余量：引擎按 AP 取整位移会过冲，贴边容易被 planMove 判出射程 */
const BAND_MARGIN = 0.15

/** 某招的射程（运行时招式 + 武器射程） */
function rangeOf(self: Character, state: BattleState, def: ActionDefinition): [number, number] {
    const runtime = getRuntimeAction(def.id, self, state) ?? def
    return getActionRange(runtime, self.getEffectiveRange(), self)
}

/** 默认评估器（无缓存时用；generatePlans 传自己的 evalAt 复用缓存） */
function defaultEvalAt(self: Character, state: BattleState, enemy: Character): EvalAt {
    const effRange = self.getEffectiveRange()
    return (dist, def) => calcExpectedDamage(def, self, enemy, effRange, state, dist)
}

/** 最优射程带 + 该档最省一招的 AP */
export interface OptimalBand {
    lo: number
    hi: number
    /** 该档最省一招的 AP（含缠的机会成本）——留够它，移动之后本回合还能出手 */
    attackAp: number
}

/**
 * 「最优射程带」：每 AP 期望伤害达到最高档（容差内）的招式的射程并集。
 *
 * 为什么能算而不是穷举：伤害与距离无关（`calcFinalDamage` 的距离乘数恒为 1），
 * 所以每张招在自己的射程内是常数 ⇒「每 AP 期望伤害」关于距离是**分段常数**函数，
 * 极值只在各招射程端点处变化。于是每张招在射程内取一点估速率，就能定出最优带。
 */
export function optimalRangeBand(
    self: Character,
    state: BattleState,
    candidates: ActionDefinition[],
    current: number,
    evalAtArg?: EvalAt,
): OptimalBand | null {
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy || candidates.length === 0) return null
    const evalAt = evalAtArg ?? defaultEvalAt(self, state, enemy)
    const rated = candidates.map((def) => {
        const range = rangeOf(self, state, def)
        // 在射程内取离当前距离最近的点：速率与距离无关，取哪都一样，这样最省评估（还能命中 evalCache）
        const d = Math.min(Math.max(current, range[0]), range[1])
        const est = evalAt(d, def)
        const ap = Math.max(0.01, est.apCost + chanOpportunityCost(self, est.chanCost ?? 0))
        return { range, ap, rate: est.expectedDamage / ap }
    })
    const maxRate = Math.max(...rated.map((r) => r.rate))
    if (!(maxRate > 0)) return null
    const best = rated.filter((r) => r.rate >= maxRate * (1 - RATE_TOL))
    return {
        lo: Math.min(...best.map((r) => r.range[0])),
        hi: Math.max(...best.map((r) => r.range[1])),
        attackAp: Math.min(...best.map((r) => r.ap)),
    }
}

/**
 * 意图方向：**风格差距决定「往最优带的哪一端站」**，它不参与定价（不乘分数）。
 * 'far' = 站到远端（把对手挡在它射程外 —— 距离唯一的真实收益）；'near' = 够得到就行。
 * 表沿用原设计意图：ranged 恒远端；clinch 恒近端；melee 对 clinch 拉远、否则近端；
 * mid 看对手（对手近战/贴身 → 拉远，否则近端）。
 */
export function intentDirection(self: Character, enemy: Character): 'far' | 'near' {
    const enemyStyle: AttackStyle = enemy.build.battleStyle
    const kiting = enemyStyle === 'melee' || enemyStyle === 'clinch'
    switch (self.build.battleStyle) {
        case 'ranged':
            // 同风格不贴脸也不风筝：双方都够得到时拉开零收益（打得到就行）
            return enemyStyle === 'ranged' ? 'near' : 'far'
        case 'clinch':
            return 'near'
        case 'melee':
            return enemyStyle === 'clinch' ? 'far' : 'near'
        case 'mid':
        default:
            return kiting ? 'far' : 'near'
    }
}

/** 没有任何「能打出伤害的候选招」时的兜底带：直接用武器射程（贴脸下限仍受召唤物约束） */
function weaponBand(self: Character): OptimalBand | null {
    const eff = self.getEffectiveRange()
    const lo = Math.max(eff[0], summonMinRange(self) ?? -Infinity)
    if (!(eff[1] >= lo)) return null
    return { lo, hi: eff[1], attackAp: 1 }
}

/**
 * 从最优带算出「本次意图该站的点」（不含 AP 夹取）；null = 已经在想要的位置。
 * 与 `bandGoal` 分开是因为位置校验要在**打完段1的位置**上重算同一个意图（带本身与距离无关）。
 */
function goalFromBand(
    self: Character,
    state: BattleState,
    band: OptimalBand,
    current: number,
): { goal: number; attackAp: number } | null {
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return null
    // 进带子的入口：贴太近会让三相珠这类召唤物失效，所以下限不能低于召唤物射程下限
    const entryLo = Math.max(band.lo + BAND_MARGIN, summonMinRange(self) ?? -Infinity)
    const farPoint = Math.max(entryLo, band.hi - BAND_MARGIN)
    const dir = intentDirection(self, enemy)
    let goal: number | null
    if (current < band.lo - 0.01) {
        // 太近（打不到）：near 取最近入口；far 直接奔远端
        goal = dir === 'far' ? farPoint : entryLo
    } else if (current > band.hi + 0.01) {
        // 太远（打不到）：从远侧进入，最近入口就是远端
        goal = farPoint
    } else {
        // 已经够得到：near 不再无脑贴脸（伤害与距离无关，贴近没有收益）；far 继续站到远端
        goal = dir === 'far' ? farPoint : null
    }
    if (goal === null || Math.abs(goal - current) < 0.05) return null
    return { goal, attackAp: band.attackAp }
}

/** 意图目标距离 + 该档一招的 AP（不含预算夹取）；null = 已经在想要的位置 */
function bandGoal(
    self: Character,
    state: BattleState,
    candidates: ActionDefinition[],
    current: number,
    evalAtArg?: EvalAt,
): { goal: number; attackAp: number } | null {
    // 没有可用招（无奖励/全在冷却/资源不足）时退回武器射程，避免「站着不动一回合」
    const band = optimalRangeBand(self, state, candidates, current, evalAtArg) ?? weaponBand(self)
    return band ? goalFromBand(self, state, band, current) : null
}

/**
 * 招式自带位移结算后的距离（对齐引擎 handlers 的规则与顺序）。
 * 计划评估必须算进它，否则「天外飞仙」这种靠 `short_dash` 冲脸的招会被当成还站在远端：
 * 它实际把施法者拖到武器射程上限（贴身），下一回合就吃对手一套。
 * - `short_dash`（主招双向垫步）：距离超过武器射程上限 → 冲近 min(超出量, maxDistance)；低于下限 → 后退到下限
 * - `dash`：朝 targetDist 位移 min(超出量, maxRange)（targetDist < 0 = 自身最大招射程）
 * - `step_back`：命中后自身后退 distance 米（对掌弹开类）
 * - `knockback`：把对手推开 distance 米（距离同样变大）
 */
function postDistanceAfter(self: Character, state: BattleState, from: number, actions: UsableAction[]): number {
    let dist = from
    const effRange = self.getEffectiveRange()
    for (const a of actions) {
        const runtime = getRuntimeAction(a.id, self, state) ?? a.def
        for (const eff of runtime.effects ?? []) {
            if (eff.type === 'short_dash') {
                const maxDash = eff.maxDistance ?? 2
                if (dist > effRange[1]) dist -= Math.min(dist - effRange[1], maxDash)
                else if (dist < effRange[0]) dist += Math.min(effRange[0] - dist, maxDash)
            } else if (eff.type === 'dash') {
                const targetDist = eff.targetDist < 0 ? self.getMaxActionRange(state) : eff.targetDist
                const desired = dist - targetDist
                if (desired !== 0 && Math.abs(desired) >= (eff.minRange ?? 0)) {
                    dist -= Math.sign(desired) * Math.min(Math.abs(desired), eff.maxRange ?? Infinity)
                }
            } else if (eff.type === 'step_back') {
                // 缺少 distance 时引擎按 1 米算（handlers 的默认值）
                dist += eff.distance ?? 1
            } else if (eff.type === 'knockback' && eff.distance > 0) {
                dist += eff.distance
            }
        }
    }
    return Math.max(0, dist)
}

/**
 * 位置规则（结束位置校验）：意图决定「该站哪」，它是规则不是加分。
 * - dir='far'：站到最优带远端；dir='near'：够得到就行（带内任意点都算满足）
 * - 够不到目标时，要求把「没花在招式上的 AP」**全部**用于朝目标方向移动
 *   （`apBudget - attacksAp` 折算的距离就是本次允许的极限）—— 否则 伤害/AP 恒偏好
 *   「多打一招、原地不动或被冲脸招拖近」，「打完就走」永远不会发生。
 * @param anchor 段1（移动前的招）结算后的距离
 * @param end 整条计划结算后的距离（含招式自带位移）
 */
function positionRuleOk(
    self: Character,
    state: BattleState,
    enemy: Character,
    band: OptimalBand,
    anchor: number,
    end: number,
    attacksAp: number,
    apBudget: number,
): boolean {
    const perAp = movePerAp(self, state)
    const tol = perAp + 0.05 // 位移按 perAp×AP 走，落点是离散的 → 留一步的容差
    const entryLo = Math.max(band.lo + BAND_MARGIN, summonMinRange(self) ?? -Infinity)
    const farPoint = Math.max(entryLo, band.hi - BAND_MARGIN)
    const dir = intentDirection(self, enemy)
    // 够得到就行：带内（含被招拖到带内别处）就算满足
    if (dir === 'near' && end >= band.lo - tol && end <= band.hi + tol) return true
    // 否则朝意图端站：far 奔远端；near 打不到时进带子（太近进近端、太远进远端）
    const goal = dir === 'far' ? farPoint : end < band.lo ? entryLo : farPoint
    const step = perAp * Math.max(0, apBudget - attacksAp)
    const ideal = goal >= anchor ? Math.min(goal, anchor + step) : Math.max(goal, anchor - step)
    return goal >= anchor ? end >= ideal - tol : end <= ideal + tol
}

/** 意图目标距离（不含预算）：给「没有可行攻击计划」时的兜底走位用 */
export function intentGoal(
    self: Character,
    state: BattleState,
    candidates: ActionDefinition[],
    current: number,
    evalAtArg?: EvalAt,
): number | null {
    return bandGoal(self, state, candidates, current, evalAtArg)?.goal ?? null
}

/**
 * 本回合的意图目标距离（含 AP 预算）：走不到目标就走到**预算允许的最远处**（留够至少一招的 AP），
 * 而不是把这一档整条丢掉。返回 null = 本回合不移动。
 */
export function intentTarget(
    self: Character,
    state: BattleState,
    candidates: ActionDefinition[],
    current: number,
    apBudget: number,
    evalAtArg?: EvalAt,
): number | null {
    const g = bandGoal(self, state, candidates, current, evalAtArg)
    if (!g) return null
    const maxStep = movePerAp(self, state) * Math.max(0, apBudget - g.attackAp)
    const target = g.goal > current ? Math.min(g.goal, current + maxStep) : Math.max(g.goal, current - maxStep)
    return Math.abs(target - current) < 0.05 ? null : target
}

/**
 * 生成所有可行回合计划。
 * @param candidates 可作主招的招式（已过滤标签/可用性/资源）
 * @param apBudget 本回合可用 AP（已扣前摇）
 * @param precomputed planEvent 收集候选时已按当前距离算好的评估（复用，避免 pool 构建重复评估）
 */
export type AttackStyle = 'melee' | 'mid' | 'ranged' | 'clinch'

/** 根据武器射程判断战斗风格（纯武器判断，不考虑具体招式） */
export function classifyAttackStyle(weaponRange: [number, number]): AttackStyle {
    const maxRange = weaponRange[1]
    if (maxRange >= 6) return 'ranged'
    if (maxRange >= 4) return 'mid'
    // 射程下限为 0 且上限 ≤2（空手/贴脸武器）→ 贴身风格：贴到 0m
    if (weaponRange[0] <= 0 && maxRange <= 2) return 'clinch'
    return 'melee'
}

export function generatePlans(
    self: Character,
    state: BattleState,
    candidates: ActionDefinition[],
    apBudget: number,
    precomputed?: Map<string, DamageEstimate>,
): ActionPlan[] {
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return []
    const current = state.position.distance(self.id, enemy.id)
    // 武器射程在计划生成期间不变（换武器是效果层事件，不在本回合计划内发生）——取一次复用
    const effRange = self.getEffectiveRange()

    // 距离级评估缓存：同一 (距离, 招式) 只评估一次（热路径关键）。
    // current 距离复用 planEvent 的预评估；段2 各落点（连续值）第一次算后缓存
    const evalCache = new Map<string, DamageEstimate>()
    const evalAt = (dist: number, def: ActionDefinition): DamageEstimate => {
        if (dist === current) {
            const p = precomputed?.get(def.id)
            if (p) return p
        }
        const key = `${Math.round(dist * 100) / 100}::${def.id}`
        const hit = evalCache.get(key)
        if (hit) return hit
        const est = calcExpectedDamage(def, self, enemy, effRange, state, dist)
        evalCache.set(key, est)
        return est
    }

    // 预计算每个候选招的评估（伤害/AP 用当前 state 评估；canReach 由各段按目标距离动态判断）
    const pool: UsableAction[] = candidates.map((def) => {
        const est = evalAt(current, def)
        const runtime = getRuntimeAction(def.id, self, state) ?? def
        return {
            id: def.id,
            def,
            priority: self.getConfig(def.id)?.priority ?? 0,
            baseApCost: est.apCost,
            chanCostAp: chanOpportunityCost(self, est.chanCost ?? 0),
            chanCost: est.chanCost ?? 0,
            range: getActionRange(runtime, effRange, self),
        }
    })

    // 所有候选招射程并集（dash 落点落入任一候选射程即可）
    const allCandRange: [number, number] = pool.reduce<[number, number]>(
        (acc, a) => [Math.min(acc[0], a.range[0]), Math.max(acc[1], a.range[1])],
        [Infinity, -Infinity],
    )
    // 移动落点不能低于召唤物射程下限（贴脸 0m 时三相珠等召唤物永远够不到）
    const summonMin = summonMinRange(self)
    if (summonMin !== null) allCandRange[0] = Math.max(allCandRange[0], summonMin)

    // 连发上限：取所有 getExtraAttack 钩子对任意招式的最大连发数
    // （分心错手 +1、漫天花雨暗器 +2；保守取 max，段2 容量 = 1 主招 + 连发数）
    const maxExtraAttack = (self2: Character): number => {
        let n = 0
        forEachHookOf(state.pendingBuffs, 'getExtraAttack', self2.id, (def) => {
            if (!def.getExtraAttack) return
            // 用池子里任意招试（分心错手无条件、漫天花雨看 thrown tag——取最大可能值）
            let best = 0
            for (const c of pool) {
                const v = def.getExtraAttack({ source: c.def })
                if (v > best) best = v
            }
            if (best > n) n = best
        })
        return n
    }

    const plans: ActionPlan[] = []
    // 位置规则要用最优带：与 bandGoal 同一套（没有可用招时退回武器射程）
    const band = optimalRangeBand(self, state, candidates, current, evalAt) ?? weaponBand(self)
    // 落点：由「风格意图」算出的目标距离（走不到就夹到预算允许处）。
    // 意图是规则不是加分：意图要动时不再生成站桩计划，否则 伤害/AP 恒偏好不动，风筝永远发生不了；
    // 「够得到就别乱动」由 intentTarget 返回 null 表达。
    const intentDist = intentTarget(self, state, candidates, current, apBudget, evalAt)
    const targetDists = intentDist === null ? [current] : [intentDist]
    // 连发数（分心错手 +1、漫天花雨暗器 +2）决定本回合总招数上限：主招 1 + 连发 N
    const extraN = maxExtraAttack(self)
    const totalHitsMax = 1 + extraN
    // 候选招的最大 short_dash（霸刀刀法给所有 slash 招 +2m 垫步等）：攻击时若距离超出武器射程
    // 会再垫步靠近（实际 = min(距离, maxDistance)），移动目标可补偿该距离省裸身移动
    const maxDash = Math.max(
        0,
        ...candidates.map((a) => {
            const dash = a.effects?.find(
                (e): e is Extract<EffectDef, { type: 'short_dash' }> => e.type === 'short_dash',
            )
            return dash?.maxDistance ?? 0
        }),
    )

    // 连发减免的 firstActionDone 是回合级标记：同一条计划的段1/段2 共享（真实引擎 onTurnEnd 才重置），
    // 但不同候选计划之间必须各算各的 → 每次试算都开新层
    const freshLayer = (): { restoreValue: number; extra: Record<string, unknown> } => ({ restoreValue: 1, extra: {} })
    const pushed = new Set<string>()
    const EMPTY: PickResult = { actions: [], totalDamage: 0, totalAp: 0 }

    /** 组装一条计划：查预算 → 过位置规则 → 去重 → 计分 */
    const pushPlan = (seg1: PickResult, movePlan: MovePlan | null, seg2: PickResult): void => {
        const moveAp = movePlan ? movePlan.apCost : 0
        const totalAp = seg1.totalAp + moveAp + seg2.totalAp
        if (totalAp > apBudget + 1e-9) return
        const totalDamage = seg1.totalDamage + seg2.totalDamage
        if (totalDamage <= 0) return
        // 真实落点：招式自带位移（天外飞仙的 short_dash 等）也要算进结束位置
        const anchor = postDistanceAfter(self, state, current, seg1.actions)
        const end = postDistanceAfter(self, state, movePlan ? movePlan.landDist : anchor, seg2.actions)
        if (band && !positionRuleOk(self, state, enemy, band, anchor, end, totalAp - moveAp, apBudget)) return
        const cmds: ActionCommand[] = []
        for (const a of seg1.actions) cmds.push({ type: 'attack', actionId: a.id })
        if (movePlan) cmds.push(movePlan.cmd)
        for (const a of seg2.actions) cmds.push({ type: 'attack', actionId: a.id })
        const sig = cmds.map((c) => (c.type === 'move' ? `move:${c.bestDistance}` : `${c.type}:${c.actionId}`)).join('|')
        if (pushed.has(sig)) return
        pushed.add(sig)
        // 伤害 = 段1 + 段2；缠劲成本 = 段1+段2 总消耗按既有公式一次性折算（阈值跌破 30 只看总消耗）
        const totalChanCost =
            seg1.actions.reduce((s, a) => s + a.chanCost, 0) + seg2.actions.reduce((s, a) => s + a.chanCost, 0)
        const totalChan = calcChanCostInAp(self.chan, totalChanCost)
        const totalCost = totalAp + totalChan
        plans.push({ cmds, totalDamage, totalAp, totalChan, score: totalCost > 0 ? totalDamage / totalCost : 0 })
    }

    // 形状 A（先动后打）：走到意图目标再出招；意图要求「够得到就别乱动」时就是站桩打。
    // 段1：移动前（当前距离）能打。仅当有连发时允许起手 1 招（起手占用连发名额，
    // 否则主招+连发已是上限，段1 会超招）。无连发时段1 恒空 —— 那种情况下「先打后动」由形状 B 负责。
    for (const target of targetDists) {
        const mockLayer = freshLayer()
        const seg1Max = extraN > 0 ? 1 : 0
        const seg1 = pickActions(self, state, pool, current, apBudget, seg1Max, new Set(), mockLayer, evalAt)
        if (seg1.totalAp > apBudget + 1e-9) continue
        // 段1 自带位移后的真实起点（如带 short_dash 的起手招会先冲近）
        const anchor = postDistanceAfter(self, state, current, seg1.actions)

        // 移动：anchor → target（优先位移招式，如虎跃/筋斗；否则走路）。
        // acceptableRange = 候选招射程并集：dash 落点落入任一候选招射程即可（big_leap 贴脸也能用）。
        // target == anchor 时无需移动（站桩打，如大津 4m 落月），planMove 返回 null 是合法的空移动。
        // 攻击招自带 short_dash（霸刀刀法等）：攻击时若距离超出武器射程会再垫步靠近（实际 = min(距离, maxDistance)），
        // 所以靠近移动（target < anchor）时可以少走 maxDash——走到 target+maxDash（不超 anchor），
        // 攻击垫步后落到 target 附近，省 maxDash 米裸身移动。退向 target（贴脸 target > anchor）时垫步
        // 方向相反用不上，直接走到 target。无 short_dash 招时 maxDash=0，行为不变。
        const needMove = Math.abs(anchor - target) >= 0.05
        let movePlan: MovePlan | null = null
        if (needMove) {
            const rawMoveTarget = target < anchor ? Math.max(target, Math.min(anchor, target + maxDash)) : target
            // 垫步补偿不能把落点推出「所有招的射程并集」——否则 planMove 的落点校验会否掉整条计划
            const moveTarget = Math.min(Math.max(rawMoveTarget, allCandRange[0]), allCandRange[1])
            movePlan = planMove(self, state, anchor, moveTarget, apBudget - seg1.totalAp, allCandRange)
            if (!movePlan) continue
        }

        // 段2：在真实落点评估。带 short_dash 的招其射程已在 getActionRange 扩展（base+dash），
        // 站桩超武器射程时 AI 会靠 dash 招自身的扩展射程够到；无 dash 招不被误判为可垫步。
        // 不再做全局 maxDash 距离修正——那会把「别招的自带 dash」误用到无 dash 招上，
        // 生成引擎实际打不到的计划（如 7m 站桩却选 4m 射程招）。
        const seg2Dist = movePlan ? movePlan.landDist : anchor
        const seg2Budget = apBudget - seg1.totalAp - (movePlan ? movePlan.apCost : 0)
        const seg2Max = totalHitsMax - seg1.actions.length
        const exclude = new Set<string>(seg1.actions.map((a) => a.id))
        const seg2 = pickActions(self, state, pool, seg2Dist, seg2Budget, seg2Max, exclude, mockLayer, evalAt)
        pushPlan(seg1, movePlan, seg2)
    }

    // 形状 B（先打后动 / 后置移动）：在当前距离把招打完，再用剩余 AP 退到意图位置。
    // 为什么必须有这条形状：天外飞仙这类自带 short_dash 的冲脸招「攻击时」就把自己拖到武器射程内，
    // 形状 A 的「先走到远端再出招」会把它刚走出来的位置又还回去（结束位置贴身）→ 位置规则会否掉它。
    // 「位移优先于额外招，但保底最强一招」：先按满预算试打一次拿到真实落点，算出退到意图位置要多少 AP，
    // 把它从预算里扣掉再正式选招 —— 否则 伤害/AP 恒偏好「多打一招、原地不动」，打完就走永远不会发生。
    {
        const trial = pickActions(self, state, pool, current, apBudget, totalHitsMax, new Set(), freshLayer(), evalAt)
        if (trial.actions.length > 0) {
            const trialAnchor = postDistanceAfter(self, state, current, trial.actions)
            const trialGoal = band ? goalFromBand(self, state, band, trialAnchor) : null
            const bestOne = pickActions(self, state, pool, current, apBudget, 1, new Set(), freshLayer(), evalAt)
            const need = trialGoal ? moveCost(self, state, trialAnchor, trialGoal.goal) : 0
            const reserve = Math.min(need, Math.max(0, apBudget - bestOne.totalAp))
            const seg1 = pickActions(
                self,
                state,
                pool,
                current,
                Math.max(0, apBudget - reserve),
                totalHitsMax,
                new Set(),
                freshLayer(),
                evalAt,
            )
            const anchor = postDistanceAfter(self, state, current, seg1.actions)
            const tailBudget = apBudget - seg1.totalAp
            const tailGoal = band ? goalFromBand(self, state, band, anchor) : null
            let tail: MovePlan | null = null
            if (tailGoal && tailBudget > 0 && Math.abs(tailGoal.goal - anchor) >= 0.05) {
                const goal = Math.min(Math.max(tailGoal.goal, allCandRange[0]), allCandRange[1])
                // 先按完整意图目标试：位移招（凤反这类 1 AP 瞬移到最大射程）允许一步到位，
                // 走路够不到就由 planMove 自己否掉；再退回「预算允许的最远处」走路。
                // 不能只传夹短后的目标——否则位移落点会被「离夹短目标更远」的守卫误杀，
                // 「AP 少但刚好够一次瞬移」的退位计划就永远生成不出来。
                tail = planMove(self, state, anchor, goal, tailBudget, allCandRange)
                if (!tail) {
                    const step = movePerAp(self, state) * tailBudget
                    const want =
                        tailGoal.goal >= anchor
                            ? Math.min(tailGoal.goal, anchor + step)
                            : Math.max(tailGoal.goal, anchor - step)
                    if (Math.abs(want - anchor) >= 0.05) {
                        const partial = Math.min(Math.max(want, allCandRange[0]), allCandRange[1])
                        tail = planMove(self, state, anchor, partial, tailBudget, allCandRange)
                    }
                }
            }
            // 打完还在意图位置上 → 就是站桩打（pushPlan 会去重掉和形状 A 重复的那条）
            pushPlan(seg1, tail, EMPTY)
        }
    }

    return plans
}

/** 选择最优计划：效率最高，效率相同取总伤害高者 */
export function bestPlan(plans: ActionPlan[]): ActionPlan | null {
    if (plans.length === 0) return null
    return plans.reduce((best, p) => {
        if (Math.abs(p.score - best.score) > 1e-9) return p.score > best.score ? p : best
        return p.totalDamage > best.totalDamage ? p : best
    })
}

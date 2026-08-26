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
 * 新模型：对每个关键移动落点，生成「段1(移动前打) → 移动 → 段2(移动后打) → 收尾移动」
 * 的完整序列，按 伤害/AP 效率 评估（效率相同取总伤害高者），选最优计划。
 */

/** 落点偏好权重：对手近战 → 风筝（走最远）、对手远程 → 贴脸（走最近）的评分加成（"首选"倾向） */
const LANDING_PREF_WEIGHT = 0.5
import type { Character } from '../entities/character'
import type { ActionDefinition, EffectDef } from '../entities/action'
import { getAction, getActionRange, getRuntimeAction } from '../../data/actions'
import type { BattleState, ActionCommand } from '../combat/types'
import { getWeapon } from '../../data/weapons/weapons'
import { forEachBuffOf, calcExtraMoveEfficiency } from '../combat/utils'
import { PositionSystem } from '../combat/position'
import { calcExpectedDamage, type DamageEstimate } from './expected-damage'
import { classifyAttackStyle, type AttackStyle } from './move-planner'
import { chanOpportunityCost, calcChanCostInAp } from '../calc/chan-value'

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
    /** 身法减免后的基础 AP 成本（不含 onActionCost 连招减免，引擎动态算） */
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
 * 从招式池里按「伤害/AP 效率」贪心选招（在 dist 距离能打到的）。
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
    forEachBuffOf(state.pendingBuffs, self.id, (_def, _layer) => {
        if (!_def?.onActionCost) return
        // 用 mock layer 代替真实 layer（钩子读写 firstActionDone，避免污染）
        const r = _def.onActionCost({
            final: 0,
            raw: 0,
            attacker: self,
            target: enemy,
            state,
            layer: mockLayer as unknown as typeof _layer,
            source: a.def,
        })
        cost = Math.max(1, cost + r)
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
        ? 2
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
    const walkAp = moveCost(self, state, from, to)

    // 遍历位移招式（dash/short_dash），找一个能接近目标且更省 AP 的
    let bestDash: MovePlan | null = null
    for (const inst of self.actions) {
        const dashEff = inst.def.effects?.find((e): e is Extract<EffectDef, { type: 'dash' }> => e.type === 'dash')
        if (!dashEff) continue
        if (inst.def.chanCost && self.chan < inst.def.chanCost) continue
        if (inst.def.canUse && !inst.def.canUse(self, state)) continue
        const { minRange = 0, maxRange = Infinity, targetDist: rawTarget } = dashEff
        const targetDist = rawTarget < 0 ? self.getMaxActionRange(state) : rawTarget
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
    const perAp = movePerAp(self, state)
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
        const r = action.getRange?.(weapon.range, self) ?? weapon.range
        max = Math.max(max, r[0])
    }
    consider(weapon.summon)
    for (const art of self.artifactDefs) consider(art.summon)
    return Number.isFinite(max) ? max : null
}

/**
 * 生成关键移动落点：站桩点 + 可攻击区间内的 4 个点（射程最小/最大 + 中间 2 点）。
 * 不再按风格只给 1-2 个点——所有点都参与评分，对手风格决定偏好侧（generatePlans 加权：
 * 对手近战→风筝走最远、对手远程→贴脸走最近）。落点由 AP 预算自然筛选（走太远 AP 不够的计划
 * 评分低/被拒），中间点覆盖"移动成本 vs 剩余攻击 AP"的折中。
 */
export function keyDistances(self: Character, state: BattleState, candidates: ActionDefinition[]): number[] {
    const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
    const enemy = state.characters.find((c) => c.id !== self.id)
    const current = enemy ? state.position.distance(self.id, enemy.id) : 4
    // 站桩点不能低于召唤物射程下限：贴 0 时三相珠等召唤物失效（主输出全丢）
    const summonMin = summonMinRange(self)
    const standPoint = summonMin !== null ? Math.max(current, summonMin) : current
    const dists = new Set<number>([standPoint])

    if (candidates.length === 0) return [...dists]

    const ranges = candidates.map((a) => {
        const runtime = getRuntimeAction(a.id, self, state) ?? a
        return getActionRange(runtime, weapon.range, self)
    })
    const rangeMaxes = ranges.map(([, hi]) => hi)
    const rangeMins = ranges.map(([lo]) => lo)
    const maxRange = Math.max(...rangeMaxes)
    const minRange = Math.min(...rangeMins)
    // 贴脸点：本体招下限与召唤物射程下限取大（贴脸 = 攻击距离下限，不是 0）。
    // 注意：不在此处 +short_dash——垫步只在攻击时距离超出武器射程才发生且距离动态
    // （min(距离, maxDistance)），移动补偿放在 generatePlans 的 planMove 里统一处理
    const meleePoint = summonMin !== null ? Math.max(minRange, summonMin) : minRange

    // 可攻击区间 [meleePoint, maxRange] 内 4 点：最小 / 1/3 / 2/3 / 最大
    if (Number.isFinite(meleePoint)) dists.add(meleePoint)
    if (Number.isFinite(maxRange) && maxRange > meleePoint + 0.01) {
        const step = (maxRange - meleePoint) / 3
        dists.add(Math.round((meleePoint + step) * 100) / 100)
        dists.add(Math.round((meleePoint + 2 * step) * 100) / 100)
        dists.add(maxRange)
    }
    return [...dists].sort((a, b) => a - b)
}

/**
 * 生成所有可行回合计划。
 * @param candidates 可作主招的招式（已过滤标签/可用性/资源）
 * @param apBudget 本回合可用 AP（已扣前摇）
 * @param precomputed planEvent 收集候选时已按当前距离算好的评估（复用，避免 pool 构建重复评估）
 */
export function generatePlans(
    self: Character,
    state: BattleState,
    candidates: ActionDefinition[],
    apBudget: number,
    precomputed?: Map<string, DamageEstimate>,
): ActionPlan[] {
    const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return []
    const style: AttackStyle = self.battleStyle ?? classifyAttackStyle(weapon.range)
    const current = state.position.distance(self.id, enemy.id)

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
        const est = calcExpectedDamage(def, self, enemy, weapon.range, state, dist)
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
            baseApCost: est.apCost,
            chanCostAp: chanOpportunityCost(self, est.chanCost ?? 0),
            chanCost: est.chanCost ?? 0,
            range: getActionRange(runtime, weapon.range, self),
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
        forEachBuffOf(state.pendingBuffs, self2.id, (def) => {
            if (!def?.getExtraAttack) return
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
    const targetDists = keyDistances(self, state, candidates)
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
    // 落点偏好（对手风格）：对手近战 → 风筝（偏最远）；对手远程 → 贴脸（偏最近）。
    // 仅作评分加权（"首选"），AP 不足时仍会自然选可行侧。目标区间 [meleePoint, maxRange]
    const enemyStyle: AttackStyle =
        (enemy.build.battleStyle as AttackStyle) ?? classifyAttackStyle(enemy.weaponDef?.range ?? [0, 2])
    const rangeMin = Math.min(...pool.map((a) => a.range[0]))
    const rangeMax = Math.max(...pool.map((a) => a.range[1]))
    const meleePoint = Math.max(rangeMin, summonMinRange(self) ?? -Infinity)
    const prefSpan = Math.max(0.01, rangeMax - meleePoint)

    for (const target of targetDists) {
        // 落点偏好乘数：对手 melee → 目标越远加成越高；对手 ranged → 目标越近加成越高；mid 无偏好
        const norm = (target - meleePoint) / prefSpan
        const prefMult =
            enemyStyle === 'melee'
                ? 1 + LANDING_PREF_WEIGHT * Math.min(1, Math.max(0, norm))
                : enemyStyle === 'ranged'
                  ? 1 + LANDING_PREF_WEIGHT * Math.min(1, Math.max(0, 1 - norm))
                  : 1
        // 段1：移动前（当前距离）能打。仅当有连发时允许起手 1 招（起手占用连发名额，
        // 否则主招+连发已是上限，段1 会超招）。无连发时段1 恒空。
        const seg1Max = extraN > 0 ? 1 : 0
        // 连发减免的 firstActionDone 是回合级标记：段1/段2 共享（真实引擎 onTurnEnd 才重置）
        const mockLayer: { restoreValue: number; extra: Record<string, unknown> } = { restoreValue: 1, extra: {} }
        const seg1 = pickActions(self, state, pool, current, apBudget, seg1Max, new Set(), mockLayer, evalAt)
        const seg1Ap = seg1.totalAp
        if (seg1Ap > apBudget + 1e-9) continue

        // 移动：当前 → target（优先位移招式，如虎跃/筋斗；否则走路）。
        // acceptableRange = 候选招射程并集：dash 落点落入任一候选招射程即可（big_leap 贴脸也能用）。
        // target == 当前距离时无需移动（站桩打，如大津 4m 落月），planMove 返回 null 是合法的空移动。
        // 攻击招自带 short_dash（霸刀刀法等）：攻击时若距离超出武器射程会再垫步靠近（实际 = min(距离, maxDistance)），
        // 所以靠近移动（target < current）时可以少走 maxDash——走到 target+maxDash（不超当前距离），
        // 攻击垫步后落到 target 附近，省 maxDash 米裸身移动。退向 target（贴脸 target > current）时垫步
        // 方向相反用不上，直接走到 target。无 short_dash 招时 maxDash=0，行为不变。
        const needMove = Math.abs(current - target) >= 0.05
        let movePlan: MovePlan | null = null
        let moveAp = 0
        if (needMove) {
            const moveTarget = target < current ? Math.max(target, Math.min(current, target + maxDash)) : target
            movePlan = planMove(self, state, current, moveTarget, apBudget - seg1Ap, allCandRange)
            if (!movePlan) continue
            moveAp = movePlan.apCost
        }
        if (seg1Ap + moveAp > apBudget + 1e-9) continue

        // 段2：按「垫步后的实际位置」评估——移动落点 landDist 处攻击，若超出武器射程会垫步靠近
        // （引擎：dist > weapon.range[1] 才垫步，垫步 = min(dist, maxDash)），实际打的位置更近。
        // 引擎 ceil 取整过冲/欠冲，落点 ≠ target，用真实落点与垫步修正后的位置评估
        let seg2Dist = movePlan ? movePlan.landDist : current
        if (maxDash > 0 && seg2Dist > weapon.range[1]) {
            seg2Dist = Math.max(0, seg2Dist - Math.min(seg2Dist, maxDash))
        }
        const seg2Budget = apBudget - seg1Ap - moveAp
        const seg2Max = totalHitsMax - seg1.actions.length
        const exclude = new Set<string>(seg1.actions.map((a) => a.id))
        const seg2 = pickActions(self, state, pool, seg2Dist, seg2Budget, seg2Max, exclude, mockLayer, evalAt)
        const totalAp = seg1Ap + moveAp + seg2.totalAp
        if (totalAp > apBudget + 1e-9) continue

        // 收尾：剩余 AP 做战术移动（有 AP 才动，AP 不足不动）。收尾移动也消耗 AP、
        // 影响下回合间隙 → 计入 totalAp 参与效率评分。当前距离用真实落点（target 可能 ≠ 落点）
        const remainAp = apBudget - totalAp
        const tail = tacticalMove(self, state, style, seg2Dist, remainAp)
        const tailAp = tail ? tail.apCost : 0
        const totalApWithTail = totalAp + tailAp
        if (totalApWithTail > apBudget + 1e-9) continue

        // 组装指令
        const cmds: ActionCommand[] = []
        for (const a of seg1.actions) cmds.push({ type: 'attack', actionId: a.id })
        if (movePlan) cmds.push(movePlan.cmd)
        for (const a of seg2.actions) cmds.push({ type: 'attack', actionId: a.id })
        if (tail) cmds.push(tail.cmd)

        // 连发校验：段1+段2 总招数 ≤ 1 + 主招连发（简化：段2 max 已含连发，段1 起手 1 招）
        // 伤害 = 段1 + 段2；缠劲成本 = 段1+段2 总消耗按既有公式一次性折算（阈值跌破 30 只看总消耗）
        const totalDamage = seg1.totalDamage + seg2.totalDamage
        if (totalDamage <= 0) continue
        const totalChanCost =
            seg1.actions.reduce((s, a) => s + a.chanCost, 0) + seg2.actions.reduce((s, a) => s + a.chanCost, 0)
        const totalChan = calcChanCostInAp(self.chan, totalChanCost)
        const totalCost = totalApWithTail + totalChan
        const score = totalCost > 0 ? (totalDamage / totalCost) * prefMult : 0
        plans.push({ cmds, totalDamage, totalAp: totalApWithTail, totalChan, score })
    }

    return plans
}

/** 收尾战术移动：有剩余 AP 才动；melee 贴脸，ranged/mid 风筝（向风格目标距离靠拢） */
function tacticalMove(
    self: Character,
    state: BattleState,
    style: AttackStyle,
    target: number,
    remainAp: number,
): MovePlan | null {
    if (remainAp < 0.1) return null
    const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return null
    const enemyStyle: AttackStyle =
        (enemy.build.battleStyle as AttackStyle) ?? classifyAttackStyle(enemy.weaponDef?.range ?? [0, 2])

    // 当前战斗距离（段2 结束后 ≈ target）
    const dist = target
    // 贴脸下限：本体招下限与召唤物射程下限取大（贴脸不能让召唤物失效——三相珠 [1,10] 贴 0m 打不到）
    const summonMin = summonMinRange(self)
    const meleeGoal = summonMin !== null ? Math.max(weapon.range[0], summonMin) : weapon.range[0]
    // 战术目标距离：melee 贴脸（武器最短，但不低于召唤物下限），ranged 风筝（射程最远），mid 看对手
    const goal =
        style === 'melee'
            ? meleeGoal
            : style === 'ranged'
              ? weapon.range[1]
              : enemyStyle === 'melee'
                ? weapon.range[1]
                : meleeGoal
    return planMove(self, state, dist, goal, remainAp)
}

/** 选择最优计划：效率最高，效率相同取总伤害高者 */
export function bestPlan(plans: ActionPlan[]): ActionPlan | null {
    if (plans.length === 0) return null
    return plans.reduce((best, p) => {
        if (Math.abs(p.score - best.score) > 1e-9) return p.score > best.score ? p : best
        return p.totalDamage > best.totalDamage ? p : best
    })
}

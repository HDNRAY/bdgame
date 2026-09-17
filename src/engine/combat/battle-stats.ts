import type { LogEvent } from './log-events'

/**
 * 战斗统计（伤害统计 / 承伤 / 治疗 / 命中 / 资源 / 距离）。
 *
 * 设计见 `docs/battle-stats-design.md`。要点：
 *  - 收集点在**引擎管道**（`BattleEngine.emitLog` 里最先调用），不挂在 log 监听器上，
 *    所以 `quiet` 模式（批量模拟 / tournament）也能收集；
 *  - 只读：不改判定、不影响战斗结果；引擎里不做字符串格式化，`format()` 由展示层调用；
 *  - `level` 分级：0 关 / 1 基础（输出·承伤·治疗·命中）/ 2 完整（再加资源·距离·状态）。
 */
export type StatsLevel = 0 | 1 | 2

/** 单个招式的统计（按「角色 × 招式」累计） */
export interface ActionStat {
    actionId: string
    actionName: string
    actorId: string
    /** 直接伤害（含穿透） */
    damage: number
    /** 持续伤害（DoT 单列，不混进直接伤害） */
    dot: number
    /** 独立附加伤害（`tags` 带 `bonus_damage`） */
    bonus: number
    /** 有效治疗 / 溢出 */
    heal: number
    overheal: number
    /** 出手次数（attack_start） */
    casts: number
    /** 其中来自触发槽的次数 */
    triggeredCasts: number
    /** 命中判定通过的次数（check_hit.result = true） */
    hits: number
    /** 其中真正造成伤害的次数（打中了但被吸收/减免到 0 的不计） */
    hitsWithDamage: number
    crits: number
    /** 被招架 / 被闪避 */
    parried: number
    dodged: number
    /** 失手（失心等导致动作失败，不产生伤害也没有闪避/招架事件） */
    fumbles: number
    /** 内息消耗 / 缠劲消耗（缠劲在 level ≥ 2 时统计） */
    apSpent: number
    chanSpent: number
}

/** 单个角色的统计 */
export interface CharStat {
    id: string
    /** 合计伤害 = 直接 + 持续 + 附伤 */
    dealt: number
    dealtDirect: number
    dealtDot: number
    dealtBonus: number
    /** 承伤与其中的减免量 */
    taken: number
    mitigated: number
    /** 有效治疗 / 溢出 */
    heal: number
    overheal: number
    casts: number
    /** 命中判定通过 / 其中造成伤害 */
    hits: number
    hitsWithDamage: number
    crits: number
    parried: number
    dodged: number
    fumbles: number
    /** level ≥ 2：内息 / 缠劲消耗 */
    apSpent: number
    chanSpent: number
    /** level ≥ 2：距离采样（出手/移动后的交战距离） */
    distanceSamples: number
    distanceSum: number
    /** level ≥ 2：1m 内的采样数 */
    closeSamples: number
    /** level ≥ 2：给对手挂状态的尝试 / 成功次数 */
    statusTried: number
    statusApplied: number
    /** 按招式（同一招跨回合累计） */
    actions: Map<string, ActionStat>
    /** 承伤来源招式：actionId → 伤害 */
    takenByAction: Map<string, { actionName: string; amount: number }>
}

/** 纯数据快照（跨到 UI / 存档用；Map 换成数组） */
export interface BattleStatsSnapshot {
    level: StatsLevel
    chars: Array<Omit<CharStat, 'actions' | 'takenByAction'> & {
        actions: ActionStat[]
        takenByAction: Array<{ actionId: string; actionName: string; amount: number }>
    }>
}

function emptyChar(id: string): CharStat {
    return {
        id,
        dealt: 0,
        dealtDirect: 0,
        dealtDot: 0,
        dealtBonus: 0,
        taken: 0,
        mitigated: 0,
        heal: 0,
        overheal: 0,
        casts: 0,
        hits: 0,
        hitsWithDamage: 0,
        crits: 0,
        parried: 0,
        dodged: 0,
        fumbles: 0,
        apSpent: 0,
        chanSpent: 0,
        distanceSamples: 0,
        distanceSum: 0,
        closeSamples: 0,
        statusTried: 0,
        statusApplied: 0,
        actions: new Map(),
        takenByAction: new Map(),
    }
}

function emptyAction(actorId: string, actionId: string, actionName: string): ActionStat {
    return {
        actionId,
        actionName,
        actorId,
        damage: 0,
        dot: 0,
        bonus: 0,
        heal: 0,
        overheal: 0,
        casts: 0,
        triggeredCasts: 0,
        hits: 0,
        hitsWithDamage: 0,
        crits: 0,
        parried: 0,
        dodged: 0,
        fumbles: 0,
        apSpent: 0,
        chanSpent: 0,
    }
}

const r1 = (n: number): number => Math.round(n * 10) / 10

export class BattleStats {
    readonly level: StatsLevel
    readonly chars = new Map<string, CharStat>()
    /**
     * 「角色 → 最近一次出手的招式」：`dodged` / `parried` 事件不带 actionId，
     * 靠它把闪避/招架归到具体招式上（这两个事件紧跟在 attack_start 之后）。
     */
    #lastAction = new Map<string, string>()

    constructor(level: StatsLevel = 1) {
        this.level = level
    }

    #char(id: string): CharStat {
        let c = this.chars.get(id)
        if (!c) {
            c = emptyChar(id)
            this.chars.set(id, c)
        }
        return c
    }

    #action(actorId: string, actionId: string, actionName: string): ActionStat {
        const c = this.#char(actorId)
        let a = c.actions.get(actionId)
        if (!a) {
            a = emptyAction(actorId, actionId, actionName)
            c.actions.set(actionId, a)
        }
        return a
    }

    /** 收一个战斗事件（引擎在 emitLog 最前面调用，quiet 模式也会走） */
    handle(e: LogEvent): void {
        switch (e.type) {
            case 'attack_start': {
                const c = this.#char(e.sourceId)
                const a = this.#action(e.sourceId, e.actionId, e.actionName)
                c.casts++
                c.apSpent += e.apCost
                a.casts++
                a.apSpent += e.apCost
                if (e.triggered) a.triggeredCasts++
                if (this.level >= 2) {
                    const chan = e.chanCost ?? 0
                    c.chanSpent += chan
                    a.chanSpent += chan
                }
                this.#lastAction.set(e.sourceId, e.actionId)
                break
            }

            case 'support': {
                // 辅助招的内息消耗记在角色上（不建招式条目：辅助招不进伤害榜）
                if (this.level >= 2) {
                    const c = this.#char(e.sourceId)
                    c.apSpent += e.apCost
                    c.chanSpent += e.chanCost ?? 0
                }
                break
            }

            case 'damage': {
                const isBonus = e.tags.includes('bonus_damage')
                const c = this.#char(e.sourceId)
                c.dealt += e.final
                if (isBonus) {
                    c.dealtBonus += e.final
                } else {
                    c.dealtDirect += e.final
                    c.hitsWithDamage++
                }
                const a = this.#action(e.sourceId, e.actionId, e.actionName)
                if (isBonus) {
                    a.bonus += e.final
                } else {
                    a.damage += e.final
                    a.hitsWithDamage++
                }
                const t = this.#char(e.targetId)
                t.taken += e.final
                t.mitigated += e.blocked
                const byAction = t.takenByAction.get(e.actionId)
                if (byAction) byAction.amount += e.final
                else t.takenByAction.set(e.actionId, { actionName: e.actionName, amount: e.final })
                break
            }

            case 'damage_over_time': {
                // DoT 的来源可能是挂状态的人（sourceId），也可能没记 → 归到承受方
                const actorId = e.sourceId ?? e.targetId
                const actionId = e.actionId ?? `dot:${e.status}`
                const actionName = e.actionName ?? e.status
                const c = this.#char(actorId)
                c.dealt += e.amount
                c.dealtDot += e.amount
                this.#action(actorId, actionId, actionName).dot += e.amount
                this.#char(e.targetId).taken += e.amount
                break
            }

            case 'heal':
            case 'heal_over_time': {
                const actorId = e.sourceId ?? e.targetId
                const actionId = e.actionId ?? '_heal'
                const actionName = e.actionName ?? '治疗'
                const effective = e.effective ?? e.amount // 老事件没带口径时退回名义量
                const overheal = e.overheal ?? 0
                const c = this.#char(actorId)
                c.heal += effective
                c.overheal += overheal
                const a = this.#action(actorId, actionId, actionName)
                a.heal += effective
                a.overheal += overheal
                break
            }

            case 'check_hit': {
                // 命中判定：命中率/被闪避都以它为准（每次出手都会判定，见 effects/combat.ts）
                const actionId = this.#lastAction.get(e.sourceId)
                const c = this.#char(e.sourceId)
                if (e.result) c.hits++
                else c.dodged++
                if (actionId) {
                    const a = this.#action(e.sourceId, actionId, actionId)
                    if (e.result) a.hits++
                    else a.dodged++
                }
                break
            }

            case 'check_parry': {
                if (!e.result) break
                const actionId = this.#lastAction.get(e.sourceId)
                const c = this.#char(e.sourceId)
                c.parried++
                if (actionId) this.#action(e.sourceId, actionId, actionId).parried++
                break
            }

            case 'check_crit': {
                if (!e.result) break
                const actionId = this.#lastAction.get(e.sourceId)
                const c = this.#char(e.sourceId)
                c.crits++
                if (actionId) this.#action(e.sourceId, actionId, actionId).crits++
                break
            }

            case 'fumble': {
                const actionId = this.#lastAction.get(e.sourceId)
                const c = this.#char(e.sourceId)
                c.fumbles++
                if (actionId) this.#action(e.sourceId, actionId, actionId).fumbles++
                break
            }

            case 'move': {
                if (this.level < 2) break
                const c = this.#char(e.sourceId)
                c.distanceSamples++
                c.distanceSum += e.newDistance
                if (e.newDistance <= 1) c.closeSamples++
                break
            }

            case 'status_apply': {
                if (this.level < 2) break
                const c = this.#char(e.sourceId)
                c.statusTried++
                if (e.success) c.statusApplied++
                break
            }
        }
    }

    /** 合并另一场战斗的统计（脚本跑 N 场时用） */
    merge(other: BattleStats): void {
        for (const [id, src] of other.chars) {
            const dst = this.#char(id)
            for (const k of [
                'dealt',
                'dealtDirect',
                'dealtDot',
                'dealtBonus',
                'taken',
                'mitigated',
                'heal',
                'overheal',
                'casts',
                'hits',
                'hitsWithDamage',
                'crits',
                'parried',
                'dodged',
                'fumbles',
                'apSpent',
                'chanSpent',
                'distanceSamples',
                'distanceSum',
                'closeSamples',
                'statusTried',
                'statusApplied',
            ] as const) {
                dst[k] += src[k]
            }
            for (const [actionId, a] of src.actions) {
                const d = this.#action(id, actionId, a.actionName)
                for (const k of [
                    'damage',
                    'dot',
                    'bonus',
                    'heal',
                    'overheal',
                    'casts',
                    'triggeredCasts',
                    'hits',
                    'hitsWithDamage',
                    'crits',
                    'parried',
                    'dodged',
                    'fumbles',
                    'apSpent',
                    'chanSpent',
                ] as const) {
                    d[k] += a[k]
                }
            }
            for (const [actionId, t] of src.takenByAction) {
                const d = dst.takenByAction.get(actionId)
                if (d) d.amount += t.amount
                else dst.takenByAction.set(actionId, { actionName: t.actionName, amount: t.amount })
            }
        }
    }

    /** 纯数据快照（Map → 数组） */
    snapshot(): BattleStatsSnapshot {
        return {
            level: this.level,
            chars: [...this.chars.values()].map((c) => ({
                ...c,
                actions: [...c.actions.values()],
                takenByAction: [...c.takenByAction.entries()].map(([actionId, v]) => ({
                    actionId,
                    actionName: v.actionName,
                    amount: v.amount,
                })),
            })),
        }
    }

    /** 文本报告（脚本 / 调试用） */
    format(charNames?: Record<string, string>): string[] {
        const lines: string[] = []
        const nameOf = (id: string) => charNames?.[id] ?? id
        const chars = [...this.chars.values()]

        lines.push('── 伤害输出 ──')
        for (const c of chars) {
            if (c.dealt <= 0) continue
            const hitRate = c.casts > 0 ? ((c.hits / c.casts) * 100).toFixed(1) : '0.0'
            const critRate = c.hits > 0 ? ((c.crits / c.hits) * 100).toFixed(1) : '0.0'
            const zeroed = c.hits - c.hitsWithDamage
            lines.push(
                `  ${nameOf(c.id)}  合计 ${r1(c.dealt)}（直接 ${r1(c.dealtDirect)} + 持续 ${r1(c.dealtDot)} + 附伤 ${r1(c.dealtBonus)}）`,
            )
            lines.push(
                `    出手 ${c.casts}  命中 ${c.hits}（${hitRate}%）  暴击 ${c.crits}（${critRate}%）` +
                    `  被招架 ${c.parried}  被闪避 ${c.dodged}  失手 ${c.fumbles}` +
                    (zeroed > 0 ? `  打中未造成伤害 ${zeroed}` : ''),
            )
            const actions = [...c.actions.values()]
                .map((a) => ({ a, total: a.damage + a.dot + a.bonus }))
                .filter((x) => x.total > 0 || x.a.casts > 0)
                .sort((x, y) => y.total - x.total)
            for (const { a, total } of actions) {
                const pct = c.dealt > 0 ? ((total / c.dealt) * 100).toFixed(1) : '0.0'
                const dotStr = a.dot > 0 ? ` [持续 ${r1(a.dot)}]` : ''
                const bonusStr = a.bonus > 0 ? ` [附伤 ${r1(a.bonus)}]` : ''
                const trigStr = a.triggeredCasts > 0 ? ` 触发${a.triggeredCasts}次` : ''
                // 纯 DoT / 附伤条目没有出手数，只报量
                const aZeroed = a.hits - a.hitsWithDamage
                const detail =
                    a.casts > 0
                        ? `  出手 ${a.casts} 命中 ${a.hits} 暴击 ${a.crits} 被招架 ${a.parried} 被闪避 ${a.dodged}` +
                          (aZeroed > 0 ? ` 零伤 ${aZeroed}` : '') +
                          trigStr
                        : ''
                lines.push(`    ${a.actionName}: ${r1(total)} (${pct}%)${dotStr}${bonusStr}${detail}`)
            }
        }

        lines.push('', '── 承伤 ──')
        for (const c of chars) {
            if (c.taken <= 0) continue
            lines.push(`  ${nameOf(c.id)}  合计 ${r1(c.taken)}（减免 ${r1(c.mitigated)}）`)
            const rows = [...c.takenByAction.entries()].sort((a, b) => b[1].amount - a[1].amount)
            for (const [actionId, v] of rows) {
                lines.push(`    ${v.actionName}(${actionId}): ${r1(v.amount)}`)
            }
        }

        lines.push('', '── 治疗 ──')
        for (const c of chars) {
            if (c.heal <= 0 && c.overheal <= 0) continue
            lines.push(`  ${nameOf(c.id)}  有效 ${r1(c.heal)}  溢出 ${r1(c.overheal)}`)
        }

        if (this.level >= 2) {
            lines.push('', '── 资源与距离 ──')
            for (const c of chars) {
                const avgDist = c.distanceSamples > 0 ? r1(c.distanceSum / c.distanceSamples) : 0
                const closeRate = c.distanceSamples > 0 ? ((c.closeSamples / c.distanceSamples) * 100).toFixed(1) : '0.0'
                // 注意口径：这里两条都是**消耗**，不是回复（回复/获得/溢出要新的 resource 事件，见设计文档）
                lines.push(
                    `  ${nameOf(c.id)}  内息消耗 ${r1(c.apSpent)}  缠劲消耗 ${r1(c.chanSpent)}` +
                        `  平均交战距离 ${avgDist}m  1m 内 ${closeRate}%` +
                        (c.statusTried > 0 ? `  挂状态 ${c.statusApplied}/${c.statusTried}` : ''),
                )
            }
        }

        return lines
    }
}

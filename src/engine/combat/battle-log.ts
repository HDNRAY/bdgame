import type { BattleSnapshot, BattleEvent } from './types'
import type { LogEvent } from './log-events'
import { ATTR_CN } from '../entities/attributes'

interface LogEntry {
    id: number
    timelineMs: number
    event: BattleEvent
}

export class BattleLog {
    /** 用 「」 包裹显示名 */
    static name(name: string): string {
        return `「${name}」`
    }

    // ── 消息构建器 ──

    /** 「名字」 消息体（无标签） */
    static plain(name: string, body: string): string {
        return `${BattleLog.name(name)} ${body}`
    }

    /** [标签] 「名字」 消息体 */
    static msg(label: string, name: string, body: string): string {
        return `[${label}] ${BattleLog.name(name)} ${body}`
    }

    /** [buff名] 「名字」 获得状态 */
    static buffApply(label: string, name: string): string {
        return `${BattleLog.msg(label, name, '获得状态')}`
    }

    /** [buff名] 「名字」 状态消失 */
    static buffRemove(label: string, name: string): string {
        return `${BattleLog.msg(label, name, '状态消失')}`
    }

    /** [反击] 「A」 反击 「B」 X 伤害 */
    static counterDmg(source: string, target: string, dmg: number): string {
        return `[反击] ${BattleLog.name(source)} 反击 ${BattleLog.name(target)} ${dmg.toFixed(1)} 伤害`
    }

    private entries: LogEntry[] = []
    private nextId = 0
    /** 当前缩进层级（由触发链控制） */
    indentDepth = 0

    /** 从快照解析 id → 名字 */
    private resolveName(id: string, snapshot: BattleSnapshot): string {
        for (const c of snapshot.characters) {
            if (c.id === id) return `「${c.name}」`
        }
        return `「${id}」`
    }

    push(event: BattleEvent, timelineMs: number): void {
        this.entries.push({ id: this.nextId++, timelineMs, event })
    }

    /** 从 LogEvent 转换为 BattleEvent 并存储 */
    handleLogEvent(event: LogEvent, snapshot: BattleSnapshot, tMs = 0): void {
        // tMs provided by engine.emitLog (current turn time)
        switch (event.type) {
            case 'battle_start':
                this.logBattleStart(event.actorId, event.opponentId, tMs, snapshot)
                break
            case 'defeat':
                this.logDefeat(event.loserId, event.winnerId, tMs, snapshot)
                break
            case 'attack_start':
                this.logAttack(
                    event.sourceId,
                    event.targetId,
                    event.weapon,
                    event.apCost,
                    event.apRemaining,
                    tMs,
                    snapshot,
                    event.actionName,
                    event.indent,
                    event.triggered,
                    event.bonus,
                )
                break
            case 'check_hit':
                this.logHitCheck(
                    event.sourceId,
                    event.targetId,
                    event.hitChance,
                    event.roll,
                    event.result,
                    tMs,
                    snapshot,
                )
                break
            case 'check_parry':
                this.logParry(event.sourceId, event.targetId, tMs, snapshot, event.parryChance, event.roll)
                break
            case 'check_crit':
                this.logCritCheck(event.sourceId, event.critChance, event.roll, event.result, tMs, snapshot)
                break
            case 'damage':
                this.logDamage(
                    event.sourceId,
                    event.targetId,
                    event.base,
                    1,
                    event.isCrit,
                    event.isParried,
                    event.final,
                    event.blocked,
                    tMs,
                    snapshot,
                )
                break
            case 'move':
                this.logMove(
                    event.sourceId,
                    event.delta,
                    event.newDistance,
                    event.apCost,
                    event.apRemaining,
                    tMs,
                    snapshot,
                )
                break
            case 'dodged':
                this.logDodge(event.sourceId, event.targetId, tMs, snapshot)
                break
            case 'damage_over_time':
                this.logSystem(
                    `[${event.status ?? event.actionName ?? 'DOT'}] ${this.resolveName(event.targetId, snapshot)} 受到 ${event.amount.toFixed(1)} 点伤害`,
                    tMs,
                    snapshot,
                    event.targetId,
                )
                break
            case 'fumble':
                this.logSystem(
                    `[晃神] ${this.resolveName(event.sourceId, snapshot)} 突然失神`,
                    tMs,
                    snapshot,
                    event.sourceId,
                )
                break
            case 'overheat':
                this.logSystem(
                    `[过热] ${this.resolveName(event.targetId, snapshot)} 受到 ${event.damage.toFixed(1)} 点过热伤害`,
                    tMs,
                    snapshot,
                    event.targetId,
                )
                break
            case 'stat_change':
                this.logAttrChange(
                    this.resolveName(event.targetId, snapshot),
                    event.attr,
                    event.delta,
                    event.label,
                    tMs,
                    snapshot,
                )
                break
            case 'heal': {
                const src = event.sourceId ? this.resolveName(event.sourceId, snapshot) : undefined
                const msg = src
                    ? `[回复] ${src} → ${this.resolveName(event.targetId, snapshot)} +${event.amount.toFixed(1)}HP`
                    : `[回复] ${this.resolveName(event.targetId, snapshot)} +${event.amount.toFixed(1)}HP`
                this.push({ type: 'system', message: msg, indent: this.indentDepth, snapshot }, tMs)
                break
            }
            case 'interrupt':
                this.logSystem(
                    `[打断] ${this.resolveName(event.targetId, snapshot)} 被中断`,
                    tMs,
                    snapshot,
                    event.targetId,
                )
                break
            case 'cleanse':
                this.logSystem(
                    `[净化] ${this.resolveName(event.targetId, snapshot)} 清除了负面效果`,
                    tMs,
                    snapshot,
                    event.targetId,
                )
                break
            case 'system':
                this.logSystem(event.message, tMs, snapshot, event.actorId)
                break
        }
    }

    logBattleStart(actor: string, opponent: string, timelineMs: number, snapshot: BattleSnapshot): void {
        this.push({ type: 'battle_start', actor, opponent, snapshot }, timelineMs)
    }

    logMove(
        actor: string,
        delta: number,
        newDistance: number,
        apCost: number,
        apRemaining: number,
        timelineMs: number,
        snapshot: BattleSnapshot,
    ): void {
        this.push({ type: 'move', actor, delta, newDistance, apCost, apRemaining, snapshot }, timelineMs)
    }

    logAttack(
        actor: string,
        target: string,
        weapon: string,
        apCost: number,
        apRemaining: number,
        timelineMs: number,
        snapshot: BattleSnapshot,
        actionName?: string,
        indent = 0,
        isTriggered = false,
        isBonus = false,
    ): void {
        this.push(
            {
                type: 'attack_start',
                actor,
                target,
                weapon,
                apCost,
                apRemaining,
                actionName,
                snapshot,
                indent,
                isTriggered,
                isBonus,
            },
            timelineMs,
        )
    }

    logHitCheck(
        actor: string,
        target: string,
        hitChance: number,
        roll: number,
        result: boolean,
        timelineMs: number,
        snapshot: BattleSnapshot,
    ): void {
        this.push({ type: 'check_hit', actor, target, hitChance, roll, result, snapshot }, timelineMs)
    }

    logDodge(actor: string, evader: string, timelineMs: number, snapshot: BattleSnapshot): void {
        this.push({ type: 'dodge', actor, evader, snapshot }, timelineMs)
    }

    logParry(
        actor: string,
        parrier: string,
        timelineMs: number,
        snapshot: BattleSnapshot,
        parryChance?: number,
        roll?: number,
    ): void {
        this.push({ type: 'parry', actor, parrier, parryChance, roll, snapshot }, timelineMs)
    }

    logCritCheck(
        actor: string,
        critChance: number,
        roll: number,
        result: boolean,
        timelineMs: number,
        snapshot: BattleSnapshot,
    ): void {
        this.push({ type: 'check_crit', actor, critChance, roll, result, snapshot }, timelineMs)
    }

    logDamage(
        actor: string,
        target: string,
        base: number,
        distanceMult: number,
        isCrit: boolean,
        isParried: boolean,
        final: number,
        blocked: number,
        timelineMs: number,
        snapshot: BattleSnapshot,
    ): void {
        this.push(
            { type: 'damage', actor, target, base, distanceMult, isCrit, isParried, final, blocked, snapshot },
            timelineMs,
        )
    }

    logDefeat(loser: string, winner: string, timelineMs: number, snapshot: BattleSnapshot): void {
        this.push({ type: 'defeat', loser, winner, snapshot }, timelineMs)
    }

    logSystem(message: string, timelineMs: number, snapshot: BattleSnapshot, actor?: string): void {
        this.push({ type: 'system', message, actor, indent: this.indentDepth, snapshot }, timelineMs)
    }

    /** 属性变化日志，自动映射中文属性名 */
    logAttrChange(
        actor: string,
        attr: string,
        delta: number,
        tag: string,
        timelineMs: number,
        snapshot: BattleSnapshot,
        extras?: string,
    ): void {
        const cn = ATTR_CN[attr] ?? attr
        const sign = delta >= 0 ? '+' : ''
        const msg = extras
            ? `[${tag}] ${actor} ${cn}${sign}${delta}（${extras}）`
            : `[${tag}] ${actor} ${cn}${sign}${delta}`
        this.push({ type: 'system', message: msg, indent: this.indentDepth, snapshot }, timelineMs)
    }

    getAll(): LogEntry[] {
        return [...this.entries]
    }

    clear(): void {
        this.entries = []
        this.nextId = 0
    }
}

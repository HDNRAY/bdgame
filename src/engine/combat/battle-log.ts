import type { BattleSnapshot, BattleEvent } from './types'

interface LogEntry {
    id: number
    timelineMs: number
    event: BattleEvent
}

export class BattleLog {
    private entries: LogEntry[] = []
    private nextId = 0
    /** 当前缩进层级（由触发链控制） */
    indentDepth = 0

    push(event: BattleEvent, timelineMs: number): void {
        this.entries.push({ id: this.nextId++, timelineMs, event })
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
    ): void {
        this.push(
            { type: 'attack_start', actor, target, weapon, apCost, apRemaining, actionName, snapshot, indent },
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

    getAll(): LogEntry[] {
        return [...this.entries]
    }

    clear(): void {
        this.entries = []
        this.nextId = 0
    }
}

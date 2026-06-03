import type { WeaponType } from '../calc/damage'

export type BattleEvent =
    | { type: 'battle_start'; actor: string; opponent: string }
    | { type: 'move'; actor: string; delta: number; newDistance: number; apCost: number; apRemaining: number }
    | {
          type: 'attack_start'
          actor: string
          target: string
          weapon: WeaponType
          actionName?: string
          apCost: number
          apRemaining: number
      }
    | { type: 'check_hit'; actor: string; target: string; hitChance: number; roll: number; result: boolean }
    | { type: 'dodge'; actor: string; evader: string }
    | { type: 'parry'; actor: string; parrier: string }
    | {
          type: 'damage'
          actor: string
          target: string
          base: number
          distanceMult: number
          isCrit: boolean
          isParried: boolean
          final: number
          blocked: number
      }
    | { type: 'defeat'; loser: string; winner: string }
    | { type: 'system'; message: string }

interface LogEntry {
    id: number
    timelineMs: number
    event: BattleEvent
}

export class BattleLog {
    private entries: LogEntry[] = []
    private nextId = 0

    push(event: BattleEvent, timelineMs: number): void {
        this.entries.push({ id: this.nextId++, timelineMs, event })
    }

    logBattleStart(actor: string, opponent: string, timelineMs: number): void {
        this.push({ type: 'battle_start', actor, opponent }, timelineMs)
    }

    logMove(
        actor: string,
        delta: number,
        newDistance: number,
        apCost: number,
        apRemaining: number,
        timelineMs: number,
    ): void {
        this.push({ type: 'move', actor, delta, newDistance, apCost, apRemaining }, timelineMs)
    }

    logAttack(
        actor: string,
        target: string,
        weapon: WeaponType,
        apCost: number,
        apRemaining: number,
        timelineMs: number,
        actionName?: string,
    ): void {
        this.push({ type: 'attack_start', actor, target, weapon, apCost, apRemaining, actionName }, timelineMs)
    }

    logHitCheck(
        actor: string,
        target: string,
        hitChance: number,
        roll: number,
        result: boolean,
        timelineMs: number,
    ): void {
        this.push({ type: 'check_hit', actor, target, hitChance, roll, result }, timelineMs)
    }

    logDodge(actor: string, evader: string, timelineMs: number): void {
        this.push({ type: 'dodge', actor, evader }, timelineMs)
    }

    logParry(actor: string, parrier: string, timelineMs: number): void {
        this.push({ type: 'parry', actor, parrier }, timelineMs)
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
    ): void {
        this.push({ type: 'damage', actor, target, base, distanceMult, isCrit, isParried, final, blocked }, timelineMs)
    }

    logDefeat(loser: string, winner: string, timelineMs: number): void {
        this.push({ type: 'defeat', loser, winner }, timelineMs)
    }

    logSystem(message: string, timelineMs: number): void {
        this.push({ type: 'system', message }, timelineMs)
    }

    getAll(): LogEntry[] {
        return [...this.entries]
    }

    clear(): void {
        this.entries = []
        this.nextId = 0
    }
}

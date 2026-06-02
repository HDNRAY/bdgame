import type { WeaponType } from '../calc/damage'

/** 结构化战斗事件 —— 纯数据，无描述文字 */
export type BattleEvent =
    | { type: 'battle_start'; actor: string; opponent: string }
    | { type: 'move'; actor: string; delta: number; newDistance: number }
    | { type: 'attack_start'; actor: string; target: string; weapon: WeaponType }
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
    timestamp: number
    event: BattleEvent
}

/** 战斗日志 —— 只存结构化数据 */
export class BattleLog {
    private entries: LogEntry[] = []
    private nextId = 0

    push(event: BattleEvent): void {
        this.entries.push({
            id: this.nextId++,
            timestamp: Date.now(),
            event,
        })
    }

    /** 便捷方法 */
    logBattleStart(actor: string, opponent: string): void {
        this.push({ type: 'battle_start', actor, opponent })
    }

    logMove(actor: string, delta: number, newDistance: number): void {
        this.push({ type: 'move', actor, delta, newDistance })
    }

    logAttack(actor: string, target: string, weapon: WeaponType): void {
        this.push({ type: 'attack_start', actor, target, weapon })
    }

    logHitCheck(actor: string, target: string, hitChance: number, roll: number, result: boolean): void {
        this.push({ type: 'check_hit', actor, target, hitChance, roll, result })
    }

    logDodge(actor: string, evader: string): void {
        this.push({ type: 'dodge', actor, evader })
    }

    logParry(actor: string, parrier: string): void {
        this.push({ type: 'parry', actor, parrier })
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
    ): void {
        this.push({ type: 'damage', actor, target, base, distanceMult, isCrit, isParried, final, blocked })
    }

    logDefeat(loser: string, winner: string): void {
        this.push({ type: 'defeat', loser, winner })
    }

    logSystem(message: string): void {
        this.push({ type: 'system', message })
    }

    getAll(): LogEntry[] {
        return [...this.entries]
    }

    clear(): void {
        this.entries = []
        this.nextId = 0
    }
}

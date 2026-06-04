import type { StatusInstance } from '../entities/status'
import type { Character } from '../entities/character'

// ── Engine types ──
export interface ActionCommand {
    type: 'attack' | 'move' | 'bonus' | 'defend' | 'wait'
    actionId?: string
    bestDistance?: number
}

export interface ActionResult {
    damage: number
    hit: boolean
    parried: boolean
    dodged: boolean
    crit: boolean
    distanceDelta: number
    knockbackDistance: number
}

export type BattlePhase = 'idle' | 'fighting' | 'finished'

export interface BattleState {
    phase: BattlePhase
    characters: [Character, Character]
    distance: import('./distance').DistanceSystem
    turn: import('./turn').TurnManager
    log: import('./battle-log').BattleLog
    eventActorId: string | null
    triggerUses: Map<string, number>
    pendingBuffs: Map<string, { restoreValue: number; stat: string }>
    lastWinner?: string
    actionCount: number
    /** 当前执行的招式额外前摇，回合结束时加到下回合间隔 */
    lastActionExtraDelay: number
}

export type EventPlan = (self: Character, enemy: Character, state: BattleState) => ActionCommand[]

// ── Log types ──
export interface CharacterSnapshot {
    hp: number
    maxHp: number
    ap: number
    statuses: StatusInstance[]
}

export interface BattleSnapshot {
    time: number
    phase: BattlePhase
    distance: number
    characters: [CharacterSnapshot, CharacterSnapshot]
    turn: { time: number; queue: Array<{ characterId: string; nextActionAt: number }> }
    triggerUses: [string, number][]
    pendingBuffs: [string, { restoreValue: number; stat: string }][]
    actionCount: number
}

export type BattleEvent =
    | { type: 'battle_start'; actor: string; opponent: string; snapshot: BattleSnapshot }
    | {
          type: 'move'
          actor: string
          delta: number
          newDistance: number
          apCost: number
          apRemaining: number
          snapshot: BattleSnapshot
      }
    | {
          type: 'attack_start'
          actor: string
          target: string
          weapon: string
          actionName?: string
          apCost: number
          apRemaining: number
          snapshot: BattleSnapshot
      }
    | {
          type: 'check_hit'
          actor: string
          target: string
          hitChance: number
          roll: number
          result: boolean
          snapshot: BattleSnapshot
      }
    | { type: 'dodge'; actor: string; evader: string; snapshot: BattleSnapshot }
    | { type: 'parry'; actor: string; parrier: string; parryChance?: number; roll?: number; snapshot: BattleSnapshot }
    | { type: 'check_crit'; actor: string; critChance: number; roll: number; result: boolean; snapshot: BattleSnapshot }
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
          snapshot: BattleSnapshot
      }
    | { type: 'defeat'; loser: string; winner: string; snapshot: BattleSnapshot }
    | { type: 'system'; message: string; actor?: string; snapshot: BattleSnapshot }

// ── Turn types ──
export type SystemEventType = 'buff_end' | 'tick_poison' | 'tick_burn' | 'paralyze_end' | 'stun_reset'

export interface TurnEntry {
    characterId: string
    nextActionAt: number
    systemEventType?: SystemEventType
    preDelay?: number
    stunTime?: number
}

import type { Character } from '../entities/character'
import type { PositionSystem } from './position'
import type { TurnManager } from './turn'
import type { BattleLog } from './battle-log'

// ── Engine types ──
export interface ActionCommand {
    type: 'attack' | 'move' | 'support'
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
}

export type BattlePhase = 'idle' | 'fighting' | 'finished'

export interface BuffLayer {
    buffId?: string
    restoreValue: number
    targetId?: string
    sourceId?: string
    mods?: Record<string, number>
    extra?: Record<string, number | string | boolean | number[] | string[]>
}

export interface BattleState {
    phase: BattlePhase
    characters: [Character, Character]
    position: PositionSystem
    turn: TurnManager
    log: BattleLog
    eventActorId: string | null
    eventTime: number
    pendingBuffs: Map<string, BuffLayer>
    lastWinner?: string
    actionCount: number
    /** 当前执行的招式额外前摇，回合结束时加到下回合间隔 */
    lastActionExtraDelay: number
    lastActionExtraStun: number
    /** 当前行动内累计耗时偏移（用于按耗时分散事件时间戳） */
    actionTimeOffset: number
    /** 防止触发递归 */
    isEmitting: boolean
    /** 最近一次移动的位移量（on_opponent_move 用） */
    moveDelta: number
    /** 触发去重：每条事件链每人每事件最多触发一次 */
    triggeredThisChain: Set<string> | null
}

export type EventPlan = (self: Character, enemy: Character, state: BattleState) => ActionCommand[]

// ── Log types ──

/** 快照中的 buff 信息 */
export interface ActiveBuffSnapshot {
    buffId: string
    name: string
    stacks: number
}

export interface CharacterSnapshot {
    id: string
    name: string
    hp: number
    maxHp: number
    ap: number
    maxAp: number
    chan: number
    pos: number
    weapon: string
    spriteId: string
    attrs: Record<string, number>
    baseAttrs: Record<string, number>
    buffs: ActiveBuffSnapshot[]
}

export interface BattleSnapshot {
    time: number
    phase: BattlePhase
    distance: number
    characters: [CharacterSnapshot, CharacterSnapshot]
    turn: {
        time: number
        queue: Array<{
            type: TurnEntryType
            id: string
            nextActionAt: number
            scheduledAt: number
            ownerId?: string
            preDelay?: number
            stunTime?: number
        }>
    }
    pendingBuffs: [string, BuffLayer][]
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
          indent?: number
          isTriggered?: boolean
          isBonus?: boolean
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
          actionId: string
          actionName: string
          base: number
          distanceMult: number
          isCrit: boolean
          isParried: boolean
          final: number
          blocked: number
          snapshot: BattleSnapshot
      }
    | { type: 'defeat'; loser: string; winner: string; snapshot: BattleSnapshot }
    | { type: 'system'; message: string; actor?: string; indent?: number; snapshot: BattleSnapshot }

// ── Turn types ──
export type SystemEventType = 'buff_end' | 'tick_poison' | 'tick_burn' | 'tick_buff' | 'stun_reset' | 'permanent_burn'

export type TurnEntryType = 'character' | 'system' | 'summon'

interface TurnEntryBase {
    id: string
    nextActionAt: number
    scheduledAt: number
}

export type TurnEntry =
    | (TurnEntryBase & {
          type: 'character'
          preDelay?: number
          stunTime?: number
          haste?: number
          lastAgility?: number
      })
    | (TurnEntryBase & { type: 'system'; systemEventType: SystemEventType })
    | (TurnEntryBase & { type: 'summon'; ownerId: string })

/** 不含 nextActionAt 的 TurnEntry（用于 scheduleNext） */
export type TurnEntryTemplate =
    | { type: 'character'; id: string; preDelay?: number; stunTime?: number; haste?: number }
    | { type: 'system'; id: string; systemEventType: SystemEventType }
    | { type: 'summon'; id: string; ownerId: string }

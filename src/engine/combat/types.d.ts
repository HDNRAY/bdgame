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

export interface AttrSourceBreakdown {
    passives: Record<string, number>
    artifacts: Record<string, number>
    weapons: Record<string, number>
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
    attrBreakdown: AttrSourceBreakdown
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
          /** 移动耗时（毫秒），回放据此平滑插值 */
          durationMs?: number
          /** 瞬移标记（dash 类），回放直接跳不插值 */
          blink?: boolean
          /** 移动类型：普通移动 / 垫步(short_dash) / 瞬移(dash)，format-log 用不同符号 */
          kind?: 'move' | 'short_dash' | 'dash'
          snapshot: BattleSnapshot
      }
    | {
          type: 'support'
          actor: string
          target: string
          actionId: string
          actionName: string
          apCost: number
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
          isTriggered?: boolean
          isBonus?: boolean
          summonName?: string
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
          /** 独立附加伤害（buff onAfterDealDamage，如雷法/金光） */
          bonus?: boolean
          snapshot: BattleSnapshot
      }
    | { type: 'defeat'; loser: string; winner: string; snapshot: BattleSnapshot }
    | { type: 'system'; message: string; actor?: string; apCost?: number; snapshot: BattleSnapshot }
    | {
          type: 'damage_over_time'
          actor: string
          target: string
          status: string
          amount: number
          snapshot: BattleSnapshot
      }
    | {
          type: 'heal_over_time'
          actor: string
          target: string
          label: string
          amount: number
          snapshot: BattleSnapshot
      }
    | {
          type: 'heal'
          actor: string
          target: string
          label: string
          amount: number
          snapshot: BattleSnapshot
      }
    | {
          type: 'buff_end'
          actor: string
          target: string
          label: string
          message: string
          snapshot: BattleSnapshot
      }

// ── Turn types ──
export type SystemEventType =
    | 'buff_end'
    | 'tick_poison'
    | 'tick_burn'
    | 'tick_buff'
    | 'stun_reset'
    | 'fumble_reset'
    | 'permanent_burn'

export type TurnEntryType = 'character' | 'system' | 'summon'

interface TurnEntryBase {
    id: string
    nextActionAt: number
    scheduledAt: number
}

export type TurnEntry =
    | (TurnEntryBase & {
          type: 'character'
      })
    | (TurnEntryBase & { type: 'system'; systemEventType: SystemEventType })
    | (TurnEntryBase & { type: 'summon'; ownerId: string })

/** 不含 nextActionAt 的 TurnEntry（用于 scheduleNext） */
export type TurnEntryTemplate =
    | { type: 'character'; id: string }
    | { type: 'system'; id: string; systemEventType: SystemEventType }
    | { type: 'summon'; id: string; ownerId: string }

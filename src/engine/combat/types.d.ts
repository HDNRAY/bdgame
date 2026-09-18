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

/** 属性修正表（键是属性名；`maxApMod` 这类非属性修正也用同一张表，所以键是 string） */
export type ModTable = Record<string, number>

/**
 * 层的公共面：构造期「来源层」与战斗期「buff 层」都实现它。
 *
 * 结构上一个类型、逻辑上两类（来源固有 vs 战斗内挂上）、存储上物理分开：
 * 来源层住在 `Character.sourceLayers`（不进 AI 沙盒克隆），战斗层住在 `state.pendingBuffs`。
 * 合并视图用 `layersOf()` 读。
 */
export interface LayerBase {
    /** 统一标识：来源层 = sourceId（'artifact:iron_mask'）；战斗层 = buffId */
    id?: string
    /** source = 构造期来源固有层；battle = 战斗中挂上的层（默认） */
    origin?: 'battle' | 'source'
    /**
     * 属性修正**请求值**（两类层一致）：重算时按它回放，不按"当时实际生效了多少"。
     *
     * 为什么必须是请求值：`applied`（夹取后的实际量）一旦上下文变化（来源增减、战斗层加减）
     * 就再也对不上 —— base 9 + 来源 A(+10，applied 10) + 来源 B(+20，被上限夹成 applied 11)，
     * 撤 A 若按 applied 平移 = 30−10 = 20，正确是 29。回放请求值不带这个毛病。
     */
    mods?: ModTable
    /** 实际生效的属性增减（夹取之后，仅供核对/展示；重算不读它） */
    applied?: ModTable
    /** 战斗层用：每层请求的属性修正（`mods = modsPerStack × 当前层数`，部分掉层时据此重算） */
    modsPerStack?: ModTable
    /** 战斗层用：倍增请求（attr → 倍率），重算按「乘」回放（超越 stat_multiply） */
    modsMultiply?: ModTable
    /**
     * 战斗层用：这条层的**静态**属性已折进 `Character` 的来源层账（附着 buff），物化时不要再应用一次。
     * 注意它只挡"物化时的初次施加"，**不挡重算回放** —— 运行时钩子写进 `mods` 的动态修正照常生效。
     */
    attrsInLedger?: boolean
}

export interface BuffLayer extends LayerBase {
    buffId?: string
    restoreValue: number
    targetId?: string
    /** 施加者 id（既有语义，勿与 originId 混用） */
    sourceId?: string
    /** origin === 'source' 时：拥有这条层的来源（'artifact:iron_mask' / 'weapon:yanling_blade'） */
    originId?: string
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
    /** buff 注册表（BuffRegistry extends Map，.set/.delete/.get/.entries 语义不变） */
    pendingBuffs: import('./utils/buff-registry').BuffRegistry
    lastWinner?: string
    actionCount: number
    /** 防止触发递归 */
    isEmitting: boolean
    /** 最近一次移动的位移量（on_opponent_move 用） */
    moveDelta: number
    /** 触发去重：每条事件链每人每事件最多触发一次 */
    triggeredThisChain: Set<string> | null
    /** AI 评估沙盒：克隆只含指定角色层的新 state（实现见 battle-state.ts BattleState） */
    cloneFor(charIds: readonly string[]): BattleState
    /** AI 评估沙盒（受限版）：只克隆指定角色中 def 命中 hooks 白名单的 buff 层 */
    cloneForHooks(
        charIds: readonly string[],
        hooks: readonly import('./utils/buff-registry').RegisteredHook[],
    ): BattleState
    /** 快照输出：等价 [...pendingBuffs.entries()] */
    toSnapshotEntries(): [string, BuffLayer][]
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
          /** 位移招式名（如虎跃）：纯位移 support 走 move 日志，format-log 用招式名渲染 */
          actionName?: string
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
    | 'regen_tick'

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

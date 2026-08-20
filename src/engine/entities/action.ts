import type { AttrName } from './attributes'
import type { Character } from './character'
import type { GameEntity } from './base'
import type { Tag } from './tag'
import type { BattleState } from '../combat/types'

/** 函数效果上下文（functional_damage / functional_heal 共用） */
export interface FunctionalEffectCtx {
    self: Character
    enemy: Character
    state: BattleState
    /** 在招式行后追加一行日志 */
    emitLog: (msg: string) => void
}

/** buff 持续时间：{ attr: '属性名', multiplier: 系数 } = 属性×系数 ms，系数大≈永久 */
export type BuffDuration = { attr: AttrName; multiplier: number }

/** 统一效果类型 */
export type EffectDef =
    // 战斗效果（需要命中判定）
    | {
          type: 'damage'
          scaling: Partial<Record<AttrName, number>>
          base?: number
          independentHits?: number
          piercing?: number
          piercingRatio?: number
      }
    | { type: 'fixed_damage'; value: number; independentHits?: number; piercing?: number }
    | { type: 'add_debuff'; buffId: string; stacks: number; chance: number }
    | { type: 'missing_hp_damage'; ratio: number }
    | { type: 'self_missing_hp_damage'; ratio: number }
    | { type: 'self_damage'; ratio: number }
    | { type: 'self_hp_cost'; ratio: number }
    | { type: 'ignore_parry' }
    | { type: 'interrupt' }
    | { type: 'knockback'; distance: number }
    // dash：位移到 targetDist（目标距离，<0=最大射程）。maxRange=最大位移距离（朝目标位移最多 maxRange 米），
    // minRange=最小位移距离（期望位移不足则作废）。useAp=AP 随实际位移量消耗（0.4/m）。
    | { type: 'dash'; minRange?: number; maxRange?: number; targetDist: number; useAp?: boolean }
    | { type: 'cleanse'; buffIds?: string[]; allDebuffs?: boolean; perDebuffStacks?: number }
    // 自效果（无需命中判定，总是生效）
    | { type: 'heal'; value: number; ratio?: number }
    | { type: 'stat_multiply'; stat: string; multiplier: number }
    | { type: 'stat_buff'; attrs: Record<string, number>; duration?: BuffDuration; durationMs?: number }
    | { type: 'restore_ap'; value: number }
    | { type: 'stat_transfer'; stat: string; value: number; duration: number }
    // 义体效果
    | { type: 'max_ap_mod'; value: number }
    | { type: 'max_hp_mod'; value: number }
    | { type: 'permanent_burn'; value: number }
    // 功法/奇物效果
    | { type: 'last_stand'; ratio: number }
    | { type: 'trigger_slot_mod'; value?: number; fn?: (char: Character) => number }
    | { type: 'dodge_mod'; value: number }
    | { type: 'parry_mod'; value: number }
    | { type: 'haste'; value?: number; eval?: (char: Character) => number }
    | { type: 'buff_duration_mult'; eval?: (char: Character) => number }
    | { type: 'attr_floor'; attrs: Partial<Record<AttrName, number>> }
    | { type: 'add_buff'; buffId: string; stacks?: number }
    | { type: 'remove_buff'; buffId: string; stacks?: number }
    | { type: 'ciyuan_init' }
    | { type: 'switch_weapon'; weaponId: string }
    | { type: 'retrieve_weapon' }
    | { type: 'short_dash'; maxDistance?: number }
    | { type: 'disarm'; chance?: number }
    | { type: 'self_disarm'; dropAt?: 'ground' | 'opponent' }
    | { type: 'wisdom_stat_buff'; ratio: number; attrs: AttrName[] }
    | { type: 'copy_best_passive' }
    | { type: 'steal_artifact' }
    | { type: 'dex_to_str'; ratio: number }
    | { type: 'weapon_tag'; tag: Tag }
    | {
          type: 'stat_restriction'
          check: (
              char: Character,
              attr: string,
              current: number,
              delta: number,
              sourceTags?: string[],
              state?: BattleState,
          ) => { skip?: boolean; delta?: number } | null
      }
    | { type: 'functional_damage'; fn: (ctx: FunctionalEffectCtx) => number; piercing?: number; note?: string }
    | { type: 'functional_heal'; fn: (ctx: FunctionalEffectCtx) => number; note?: string }

/** 招式定义 —— 纯数据 */
export interface ActionDefinition extends GameEntity {
    requiredTags: Tag[]
    apCost: number
    /** 消耗的缠劲层数 */
    chanCost?: number
    effects?: EffectDef[]
    target?: 'self' | 'enemy'
    /** 招式命中率回调（入参为基础命中率、状态、自身，返回实际命中率，不设则用属性公式计算） */
    onActionHitChance?: (base: number, state: BattleState, self: Character) => number
    /** 招式暴击率回调（入参为基础暴击率、状态、自身，返回实际暴击率） */
    onActionCritChance?: (base: number, state: BattleState, self: Character) => number
    /** 招式暴击伤害加成（入参为基础爆伤修正、状态、自身，返回最终爆伤修正） */
    onActionCritDamage?: (base: number, state: BattleState, self: Character) => number
    maxUses?: number
    /** 自定义释放条件（返回 false 则不可使用） */
    canUse?: (attacker: Character, state: BattleState) => boolean
    /**
     * 各 hooks 的说明（tooltip 显示用；hitChance/critChance/critDamage 只写数值如 '+25%'，
     * canUse/range 写短句如 '需缠劲≥18'/'依武器而定且+1'）。缺省该字段时 tooltip 兜底提示"随战斗变化"。
     */
    hookNotes?: {
        hitChance?: string
        critChance?: string
        critDamage?: string
        canUse?: string
        range?: string
    }
    extraPreDelay?: number
    extraStunTime?: number
    /**
     * 自定义攻击范围回调（优先级高于 range），返回招式实际范围 [min, max]
     * @param weaponRange 武器基础范围
     * @param self 使用该招式的角色（运行时可获取 buff/被动等状态）
     */
    getRange?: (weaponRange: [number, number], self?: Character) => [number, number]
}

/** 招式运行时实例（追踪限次/冷却等状态） */
export class Action {
    readonly def: ActionDefinition
    remainingUses: number

    constructor(def: ActionDefinition) {
        this.def = def
        this.remainingUses = def.maxUses ?? Infinity
    }

    get id() {
        return this.def.id
    }
    get name() {
        return this.def.name
    }
    get apCost() {
        return this.def.apCost
    }
    get effects() {
        return this.def.effects
    }

    canUse(): boolean {
        return this.remainingUses > 0
    }

    use(): void {
        if (this.def.maxUses !== undefined) this.remainingUses--
    }
}

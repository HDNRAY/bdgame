import type { AttrName } from './attributes'
import type { Character } from './character'
import type { GameEntity } from './base'
import type { Tag } from './tag'
import type { BattleState } from '../combat/types'

/** buff 持续时间：{ attr: '属性名', multiplier: 系数 } = 属性×系数 ms，系数大≈永久 */
export type BuffDuration = { attr: AttrName; multiplier: number }

/** 统一效果类型 */
export type EffectDef =
    // 战斗效果（需要命中判定）
    | { type: 'damage'; scaling: Partial<Record<AttrName, number>>; base?: number }
    | { type: 'fixed_damage'; value: number }
    | { type: 'add_debuff'; buffId: string; stacks: number; chance: number }
    | { type: 'missing_hp_damage'; ratio: number }
    | { type: 'self_missing_hp_damage'; ratio: number }
    | { type: 'self_damage'; ratio: number }
    | { type: 'ignore_parry' }
    | { type: 'interrupt' }
    | { type: 'knockback'; distance: number }
    | { type: 'dash'; minRange?: number; maxRange?: number; targetDist: number; useAp?: boolean }
    | { type: 'limit_uses'; max: number }
    | { type: 'cleanse'; buffIds?: string[] }
    // 自效果（无需命中判定，总是生效）
    | { type: 'heal'; value: number; ratio?: number }
    | { type: 'stat_multiply'; stat: string; multiplier: number; duration: BuffDuration }
    | { type: 'stat_buff'; attrs: Record<string, number>; duration?: BuffDuration; durationMs?: number }
    | { type: 'restore_ap'; value: number }
    | { type: 'summon_speed'; value: number }
    | { type: 'summon_damage_bonus'; value: number }
    | { type: 'stat_transfer'; stat: string; value: number; duration: number }
    // 义体效果
    | { type: 'max_ap_mod'; value: number }
    | { type: 'max_hp_mod'; value: number }
    | { type: 'move_efficiency'; value: number }
    | { type: 'permanent_burn'; value: number }
    // 功法/奇物效果
    | { type: 'crit_chance'; value: number; reset?: boolean }
    | { type: 'crit_damage'; value: number; reset?: boolean }
    | { type: 'last_stand'; ratio: number }
    | { type: 'weapon_range_bonus'; value: number }
    | { type: 'trigger_slot_mod'; value: number }
    | { type: 'dodge_mod'; value: number }
    | { type: 'parry_mod'; value: number }
    | { type: 'stat_parry_dodge'; parryScale?: number; dodgeScale?: number }
    | { type: 'haste'; value?: number; eval?: (char: Character) => number }
    | { type: 'attr_floor'; attrs: Partial<Record<AttrName, number>> }
    | { type: 'add_buff'; buffId: string; stacks?: number }
    | { type: 'remove_buff'; buffId: string; stacks?: number }
    | { type: 'ciyuan_init' }
    | { type: 'switch_weapon'; weaponId: string }
    | { type: 'retrieve_weapon' }
    | { type: 'short_dash'; maxDistance?: number }
    | { type: 'disarm'; chance?: number }
    | { type: 'ignore_parry' }
    | { type: 'wisdom_stat_buff'; ratio: number; attrs: AttrName[] }
    | { type: 'copy_best_passive' }
    | { type: 'add_passive'; passiveId: string }
    | { type: 'dex_to_str'; ratio: number }
    | {
          type: 'stat_restriction'
          check: (
              char: Character,
              attr: string,
              current: number,
              delta: number,
              sourceTags?: string[],
          ) => { skip?: boolean; delta?: number } | null
      }

/** 招式定义 —— 纯数据 */
export interface ActionDefinition extends GameEntity {
    requiredTags: Tag[]
    apCost: number
    /** 消耗的缠劲层数 */
    chanCost?: number
    effects?: EffectDef[]
    target?: 'self' | 'enemy'
    /** 招式固定命中率（不设则用属性公式计算） */
    chance?: number
    maxUses?: number
    /** 自定义释放条件（返回 false 则不可使用） */
    canUse?: (attacker: Character, state: BattleState) => boolean
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

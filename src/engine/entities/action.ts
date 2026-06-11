import type { AttrName } from './attributes'
import type { Condition } from './trigger'
import type { StatusType } from './status'
import type { GameEntity } from './base'
import type { Tag } from './tag'

/** buff 持续时间：{ attr: '属性名', multiplier: 系数 } = 属性×系数 ms，系数大≈永久 */
export type BuffDuration = { attr: AttrName; multiplier: number }

/** 统一效果类型 */
export type EffectDef =
    // 战斗效果（需要命中判定）
    | { type: 'damage'; scaling: Partial<Record<AttrName, number>> }
    | { type: 'fixed_damage'; value: number }
    | { type: 'status'; status: Tag; stacks: number; chance: number; attrMods?: Record<string, number> }
    | { type: 'cripple'; ratio: number }
    | { type: 'self_damage'; ratio: number }
    | { type: 'ignore_parry' }
    | { type: 'interrupt' }
    | { type: 'knockback'; distance: number }
    | { type: 'limit_uses'; max: number }
    | { type: 'modify_turn'; deltaMs: number }
    | { type: 'cleanse'; statuses?: StatusType[] }
    | { type: 'counter_damage'; ratio: number }
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
    | { type: 'fumble_chance'; value: number }
    // 功法/奇物效果
    | { type: 'crit_chance'; value: number; reset?: boolean }
    | { type: 'crit_damage'; value: number }
    | { type: 'last_stand'; ratio: number }
    | { type: 'weapon_range_bonus'; value: number }
    | { type: 'trigger_slot_mod'; value: number }
    | { type: 'dodge_mod'; value: number }

/** 招式定义 —— 纯数据 */
export interface ActionDefinition extends GameEntity {
    requiredTags: Tag[]
    apCost: number
    effects?: EffectDef[]
    target?: 'self' | 'enemy'
    /** 招式固定命中率（不设则用属性公式计算） */
    chance?: number
    maxUses?: number
    bonus?: boolean
    bonusTiming?: Condition
    extraPreDelay?: number
    extraStunTime?: number
    range?: [number, number]
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
    get bonus() {
        return this.def.bonus ?? false
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

import { AttributeSet, type AttrName } from './attributes'
import { Action, type ActionDefinition, type EffectDef } from './action'
import type { CharacterBuild } from './character-build'
import type { Passive, Talent } from './passive'
import type { Artifact } from './artifact'
import type { TriggerSlot } from './trigger'
import type { WeaponDef } from '../data/weapons'
import { getAction as getActionDef } from '../data/actions'
import { getWeapon } from '../data/weapons'
import { getPassive } from '../data/passives'
import { getArtifact } from '../data/implants'

export function calcMaxHp(vitality: number): number {
    return 20 + vitality * 10
}

export const BASE_MAX_AP = 10

export class Character {
    readonly build: CharacterBuild
    readonly id: string
    name: string
    attrs: AttributeSet
    hp: number
    ap: number
    nextTurnApDebt = 0
    /** 被动/天赋提供的持久修饰器 */
    modifiers: Set<string> = new Set()
    /** 已解析的被动对象列表 */
    passiveDefs: Passive[] = []
    /** 被动注入的额外 trigger（不污染 build.triggers） */
    passiveTriggers: TriggerSlot[] = []
    /** 武器定义的 clone（含被动修改） */
    weaponDef?: WeaponDef
    /** 已解析的奇物/义体列表 */
    artifactDefs: Artifact[] = []
    /** 义体/效果修正 */
    maxApMod = 0
    maxHpMod = 0
    fumbleChance = 0
    /** 移动效率倍率（0.2 = +20% 每AP移动距离） */
    moveEfficiency = 0

    constructor(build: CharacterBuild) {
        this.build = build
        this.id = build.id
        this.name = build.name
        this.attrs = new AttributeSet(build.baseAttrs)

        // 解析被动 ID → 定义
        this.passiveDefs = build.passives.map((id) => getPassive(id)).filter((p): p is Passive => p !== undefined)
        // 解析奇物/义体 ID → 定义
        this.artifactDefs = build.artifacts.map((id) => getArtifact(id)).filter((a): a is Artifact => a !== undefined)

        // 应用被动/奇物/武器
        for (const p of this.passiveDefs) {
            this.#applyPassive(p)
        }
        // 处理奇物效果
        for (const a of this.artifactDefs) {
            for (const eff of a.effects ?? []) {
                const handler = passiveEffectHandlers[eff.type]
                if (handler) handler(this, eff)
            }
        }
        // 处理武器效果
        const weapon = getWeapon(build.weapon)
        for (const eff of weapon.effects ?? []) {
            const handler = passiveEffectHandlers[eff.type]
            if (handler) handler(this, eff)
        }

        this.ap = this.maxAp
        this.hp = calcMaxHp(this.attrs.get('vitality')) + this.maxHpMod
    }

    get passives(): Passive[] {
        return this.passiveDefs
    }

    /** 应用被动：达标检测 → effects + triggers + modifiers */
    #applyPassive(p: Passive): void {
        // effects
        for (const eff of p.effects ?? []) {
            const handler = passiveEffectHandlers[eff.type]
            if (handler) handler(this, eff)
        }
        // triggers
        for (const slot of p.triggers ?? []) this.passiveTriggers.push(slot)
        // modifiers
        for (const mod of p.modifiers ?? []) this.modifiers.add(mod)
        // Talent-only: 条件检测
        if ('requireAttrs' in p) {
            const t = p as unknown as Talent
            if (!Object.entries(t.requireAttrs).every(([attr, req]) => this.attrs.get(attr as AttrName) >= req)) return
        }
    }

    get maxHp(): number {
        return calcMaxHp(this.attrs.get('vitality')) + this.maxHpMod
    }

    get maxAp(): number {
        return BASE_MAX_AP + this.maxApMod
    }

    get triggers(): TriggerSlot[] {
        return [...this.build.triggers, ...this.passiveTriggers]
    }

    get artifacts(): Artifact[] {
        return this.artifactDefs
    }

    #moveCache: Action[] | null = null
    get actions(): Action[] {
        if (!this.#moveCache) {
            this.#moveCache = this.build.actions
                .map((id) => {
                    const def = getActionDef(id)
                    return def ? new Action(def) : null
                })
                .filter((a): a is Action => a !== null)
        }
        return this.#moveCache
    }

    takeDamage(amount: number): void {
        this.hp = Math.max(0, this.hp - amount)
    }
    heal(amount: number): void {
        this.hp = Math.min(this.maxHp, this.hp + amount)
    }
    isAlive(): boolean {
        return this.hp > 0
    }

    resetAp(): void {
        this.ap = Math.max(0, this.maxAp - this.nextTurnApDebt)
        this.nextTurnApDebt = 0
    }

    spendAp(cost: number): boolean {
        if (this.ap < cost) return false
        this.ap -= cost
        return true
    }

    toJSON() {
        return {
            build: this.build,
            hp: this.hp,
            ap: this.ap,
            nextTurnApDebt: this.nextTurnApDebt,
        }
    }

    static fromJSON(data: ReturnType<Character['toJSON']>): Character {
        const c = new Character(data.build)
        c.hp = data.hp
        c.ap = data.ap
        c.nextTurnApDebt = data.nextTurnApDebt
        return c
    }

    /** 创建战斗用副本（所有数据独立，不污染原始） */
    cloneForBattle(): Character {
        const c = new Character(this.build)
        c.hp = this.hp
        c.ap = this.maxAp // 战斗开始满 AP
        c.nextTurnApDebt = 0
        return c
    }

    get snapshot() {
        return {
            hp: this.hp,
            maxHp: this.maxHp,
            ap: this.ap,
        }
    }
}

// ── 被动效果分发表（构造期执行，无战斗上下文） ──

const passiveEffectHandlers: Record<string, (char: Character, eff: EffectDef) => void> = {
    stat_buff(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'stat_buff' }>
        for (const [attr, value] of Object.entries(e.attrs)) {
            char.attrs.modify(attr as AttrName, value)
        }
    },
    summon_damage_bonus(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'summon_damage_bonus' }>
        const weapon = getWeapon(char.build.weapon)
        if (weapon.summon) {
            const orig = getActionDef(weapon.summon.actionId)
            if (orig) {
                const clonedAction: ActionDefinition = {
                    ...orig,
                    effects: orig.effects?.map((ef) =>
                        ef.type === 'fixed_damage' ? { ...ef, value: ef.value + e.value } : ef,
                    ),
                }
                // 克隆武器，嵌入修改后的召唤动作
                char.weaponDef = { ...weapon, summon: { ...weapon.summon, action: clonedAction } }
            }
        }
    },
    // 义体效果（构造期执行）
    max_ap_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'max_ap_mod' }>
        char.maxApMod += e.value
    },
    max_hp_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'max_hp_mod' }>
        char.maxHpMod += e.value
    },
    move_efficiency(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'move_efficiency' }>
        char.moveEfficiency += e.value
    },
    fumble_chance(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'fumble_chance' }>
        char.fumbleChance += e.value
    },
    permanent_burn(char) {
        // 运行时由 engine 处理
        char.modifiers.add('permanentBurn')
    },
}

import { AttributeSet, type AttrName } from './attributes'
import { Action } from './action'
import type { CharacterBuild } from './character-build'
import type { Passive } from './passive'
import type { Artifact } from './artifact'
import type { TriggerSlot } from './trigger'
import { getAction as getActionDef } from '../data/actions'
import { getWeapon } from '../data/weapons'
import { getPassive } from '../data/passives'

export function calcMaxHp(vitality: number): number {
    return 20 + vitality * 10
}

export class Character {
    readonly build: CharacterBuild
    readonly id: string
    name: string
    attrs: AttributeSet
    hp: number
    ap: number
    maxAp: number
    nextTurnApDebt = 0
    /** 被动/天赋提供的持久修饰器 */
    modifiers: Set<string> = new Set()
    /** 已解析的被动对象列表 */
    passiveDefs: Passive[] = []
    /** 被动注入的额外 trigger（不污染 build.triggers） */
    passiveTriggers: TriggerSlot[] = []

    constructor(build: CharacterBuild) {
        this.build = build
        this.id = build.id
        this.name = build.name
        this.attrs = new AttributeSet(build.baseAttrs)

        // 解析被动 ID → 定义
        this.passiveDefs = build.passives.map((id) => getPassive(id)).filter((p): p is Passive => p !== undefined)

        // 应用被动/奇物/武器
        for (const p of this.passiveDefs) {
            this.#applyPassive(p)
        }
        for (const a of build.artifacts) {
            if (a.statMods) {
                for (const [k, v] of Object.entries(a.statMods)) {
                    this.attrs.modify(k as AttrName, v)
                }
            }
        }
        const weapon = getWeapon(build.weapon)
        for (const [k, v] of Object.entries(weapon.attrMods)) {
            this.attrs.modify(k as AttrName, v)
        }

        this.maxAp = 10
        this.ap = this.maxAp
        this.hp = calcMaxHp(this.attrs.get('vitality'))
    }

    get passives(): Passive[] {
        return this.passiveDefs
    }

    /** 应用被动：达标检测 → effects + triggers + modifiers */
    #applyPassive(p: Passive): void {
        // requireAttrs 条件检测
        if (p.requireAttrs) {
            const qualified = Object.entries(p.requireAttrs).every(
                ([attr, req]) => this.attrs.get(attr as AttrName) >= req,
            )
            if (!qualified) return
        }
        // effects
        for (const eff of p.effects ?? []) {
            if (eff.type === 'stat_buff') {
                for (const [attr, value] of Object.entries(eff.attrs)) {
                    this.attrs.modify(attr as AttrName, value)
                }
            }
        }
        // triggers
        for (const slot of p.triggers ?? []) {
            this.passiveTriggers.push(slot)
        }
        // modifiers
        for (const mod of p.modifiers ?? []) {
            this.modifiers.add(mod)
        }
    }

    get maxHp(): number {
        return calcMaxHp(this.attrs.get('vitality'))
    }

    get triggers(): TriggerSlot[] {
        return [...this.build.triggers, ...this.passiveTriggers]
    }

    get artifacts(): Artifact[] {
        return this.build.artifacts
    }

    #moveCache: Action[] | null = null
    get moves(): Action[] {
        if (!this.#moveCache) {
            this.#moveCache = this.build.moves
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

    get snapshot() {
        return {
            hp: this.hp,
            maxHp: this.maxHp,
            ap: this.ap,
        }
    }
}

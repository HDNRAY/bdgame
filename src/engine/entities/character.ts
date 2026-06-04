import { AttributeSet, type AttrName } from './attributes'
import { ActionInstance } from './action-instance'
import type { CharacterBuild } from './character-build'
import type { Passive } from './passive'
import type { Artifact } from './artifact'
import type { TriggerSlot } from './trigger'
import { getAction } from '../data/actions'
import { getWeapon } from '../data/weapons'

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

    constructor(build: CharacterBuild) {
        this.build = build
        this.id = build.id
        this.name = build.name
        this.attrs = new AttributeSet(build.baseAttrs)

        // 应用功法/奇物的常驻属性修正
        for (const p of build.passives) {
            if (p.statMods) {
                for (const [k, v] of Object.entries(p.statMods)) {
                    this.attrs.modify(k as AttrName, v)
                }
            }
        }
        for (const a of build.artifacts) {
            if (a.statMods) {
                for (const [k, v] of Object.entries(a.statMods)) {
                    this.attrs.modify(k as AttrName, v)
                }
            }
        }

        // 应用武器的常驻属性修正
        const weapon = getWeapon(build.weapon)
        for (const [k, v] of Object.entries(weapon.attrMods)) {
            this.attrs.modify(k as AttrName, v)
        }

        this.maxAp = 10
        this.ap = this.maxAp
        this.hp = calcMaxHp(this.attrs.get('vitality'))
    }

    get maxHp(): number {
        return calcMaxHp(this.attrs.get('vitality'))
    }

    get triggers(): TriggerSlot[] {
        return this.build.triggers
    }

    get passives(): Passive[] {
        return this.build.passives
    }

    get artifacts(): Artifact[] {
        return this.build.artifacts
    }

    #moveCache: ActionInstance[] | null = null
    get moves(): ActionInstance[] {
        if (!this.#moveCache) {
            this.#moveCache = this.build.moves
                .map((id) => {
                    const def = getAction(id)
                    return def ? new ActionInstance(def) : null
                })
                .filter((a): a is ActionInstance => a !== null)
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

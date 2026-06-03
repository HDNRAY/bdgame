import { AttributeSet } from './attributes'
import { ActionInstance } from './action-instance'
import type { TriggerSlot } from './trigger'

export function calcMaxHp(vitality: number): number {
    return 20 + vitality * 10
}

export class Character {
    readonly id: string
    name: string
    attrs: AttributeSet
    hp: number
    ap: number
    maxAp: number
    nextTurnApDebt = 0
    skills: string[] = []
    actionInstances: ActionInstance[] = []
    /** 触发器槽：{ triggerId, actionId } 任意配对 */
    triggerSlots: TriggerSlot[] = []
    implants: string[] = []
    lifebound?: string
    statuses: import('./status').StatusInstance[] = []

    constructor(id: string, name: string, attrs?: Partial<Record<string, number>>) {
        this.id = id
        this.name = name
        this.attrs = new AttributeSet(attrs)
        this.maxAp = 10
        this.ap = this.maxAp
        this.hp = calcMaxHp(this.attrs.get('vitality'))
    }

    get maxHp(): number {
        return calcMaxHp(this.attrs.get('vitality'))
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

    /** 装备招式（从 ActionDefinition 创建实例） */
    equipAction(def: import('./action').ActionDefinition): void {
        if (!this.actionInstances.find((a) => a.id === def.id)) {
            this.actionInstances.push(new ActionInstance(def))
        }
    }

    get actionIds(): string[] {
        return this.actionInstances.map((a) => a.id)
    }
}

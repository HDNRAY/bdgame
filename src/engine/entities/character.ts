import { AttributeSet } from './attributes'

/** HP 计算公式: 20 + vitality × 10 */
export function calcMaxHp(vitality: number): number {
    return 20 + vitality * 10
}

/** 角色实体 */
export class Character {
    readonly id: string
    name: string
    attrs: AttributeSet
    hp: number
    ap: number
    maxAp: number
    skills: string[] = [] // 功法 ID
    actions: string[] = [] // 已学招式 ID
    triggers: string[] = [] // 触发器 ID
    implants: string[] = [] // 义体 ID
    lifebound?: string // 本命物 ID

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
        this.ap = this.maxAp
    }

    spendAp(cost: number): boolean {
        if (this.ap < cost) return false
        this.ap -= cost
        return true
    }
}

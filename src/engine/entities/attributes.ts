/** 六大属性 */
export type AttrName = 'strength' | 'vitality' | 'agility' | 'dexterity' | 'insight' | 'wisdom'

export const ALL_ATTRS: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

export const ATTR_CN: Record<string, string> = {
    strength: '力道', // 伤害缩放、招架减伤
    vitality: '体质', // HP = 20 + vit×10
    agility: '身法', // 闪避(防御方)、移动效率(agi/20 档/AP)、回合间隔(2.8/(1+agi×0.25))
    dexterity: '灵巧', // 命中(攻击方)、暴击率(与洞察叠加)
    insight: '洞察', // 命中(攻防双方)、暴击率(与灵巧叠加)、招架率
    wisdom: '推演', // 触发槽数(max(1, floor(wis/4)))、炁效果
}

export const ATTR_ABSOLUTE_MAX = 30
/** 属性下限：任何来源都压不到 3 以下（战中的减属性保护走 `stat_restriction`，不在这里做） */
export const ATTR_ABSOLUTE_MIN = 3

/** 属性容器 */
export class AttributeSet {
    private values: Record<AttrName, number>

    constructor(values?: Partial<Record<AttrName, number>>) {
        this.values = {
            strength: 3,
            vitality: 3,
            agility: 3,
            dexterity: 3,
            insight: 3,
            wisdom: 3,
            ...values,
        }
    }

    get(attr: AttrName): number {
        return Math.max(this.values[attr], ATTR_ABSOLUTE_MIN)
    }

    set(attr: AttrName, value: number): void {
        // 不设下限，地板仅在 get 时生效
        this.values[attr] = Math.min(ATTR_ABSOLUTE_MAX, value)
    }

    modify(attr: AttrName, delta: number): void {
        this.set(attr, this.values[attr] + delta)
    }

    getAll(): Record<AttrName, number> {
        return ALL_ATTRS.reduce(
            (acc, a) => {
                acc[a] = this.get(a)
                return acc
            },
            {} as Record<AttrName, number>,
        )
    }

    total(): number {
        return ALL_ATTRS.reduce((sum, a) => sum + this.get(a), 0)
    }

    clone(): AttributeSet {
        return new AttributeSet({ ...this.values })
    }
}

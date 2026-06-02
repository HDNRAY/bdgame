/** 六大属性 */
export type AttrName = 'strength' | 'vitality' | 'dexterity' | 'technique' | 'insight' | 'wisdom'

export const ALL_ATTRS: AttrName[] = ['strength', 'vitality', 'dexterity', 'technique', 'insight', 'wisdom']

export const ATTR_MIN = 1
export const ATTR_NORMAL_MAX = 20
export const ATTR_ABSOLUTE_MAX = 30

/** 属性容器 */
export class AttributeSet {
    private values: Record<AttrName, number>

    constructor(values?: Partial<Record<AttrName, number>>) {
        this.values = {
            strength: 3,
            vitality: 3,
            dexterity: 3,
            technique: 3,
            insight: 3,
            wisdom: 3,
            ...values,
        }
    }

    get(attr: AttrName): number {
        return this.values[attr]
    }

    set(attr: AttrName, value: number): void {
        this.values[attr] = Math.max(ATTR_MIN, Math.min(ATTR_ABSOLUTE_MAX, value))
    }

    modify(attr: AttrName, delta: number): void {
        this.set(attr, this.get(attr) + delta)
    }

    getAll(): Record<AttrName, number> {
        return { ...this.values }
    }

    total(): number {
        return ALL_ATTRS.reduce((sum, a) => sum + this.values[a], 0)
    }

    clone(): AttributeSet {
        return new AttributeSet({ ...this.values })
    }
}

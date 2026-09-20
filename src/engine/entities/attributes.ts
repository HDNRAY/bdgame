/** 六大属性 */
export type AttrName = 'strength' | 'vitality' | 'agility' | 'dexterity' | 'insight' | 'wisdom'

export const ALL_ATTRS: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

export const ATTR_CN: Record<string, string> = {
    strength: '力道', // 伤害缩放、招架减伤
    vitality: '根骨', // 气血上限 = 100 + 根骨×15；AP 上限 = round(4 + 根骨×0.25)；debuff 时长减免
    agility: '身法', // 闪避(防御方)、移动效率(agi/20 档/AP)、回合间隔(2.8/(1+agi×0.25))
    dexterity: '灵巧', // 命中(攻击方)、暴击率(与洞察叠加)
    insight: '洞察', // 命中(攻防双方)、暴击率(与灵巧叠加)、招架率
    wisdom: '推演', // 触发槽数(max(1, floor(wis/4)))、炁效果
}

export const ATTR_ABSOLUTE_MAX = 30
/** 属性下限：任何来源都压不到 3 以下（战中的减属性保护走 `stat_restriction`，不在这里做） */
export const ATTR_ABSOLUTE_MIN = 3

/**
 * 属性写入的唯一闸门：夹进 [MIN, MAX] 并保留 1 位小数（与 hp/ap 同一约定）。
 *
 * **不要在 `get()` 里做钳制**：读时钳制会让 `applyAttrMods` 的「前后差」记账失真 ——
 * 被钳掉的那部分不记账，回滚时自然也还不回来，属性会被永久吃掉（棘轮）。
 * 写入即夹取后，存的就是真的，`applied` 记多少、回滚就还多少。
 */
function clampAttr(value: number): number {
    return Math.min(ATTR_ABSOLUTE_MAX, Math.max(ATTR_ABSOLUTE_MIN, Math.round(value * 10) / 10))
}

/** 属性容器 */
export class AttributeSet {
    private values: Record<AttrName, number>

    constructor(values?: Partial<Record<AttrName, number>>) {
        this.values = {
            strength: ATTR_ABSOLUTE_MIN,
            vitality: ATTR_ABSOLUTE_MIN,
            agility: ATTR_ABSOLUTE_MIN,
            dexterity: ATTR_ABSOLUTE_MIN,
            insight: ATTR_ABSOLUTE_MIN,
            wisdom: ATTR_ABSOLUTE_MIN,
            ...values,
        }
        // 构造入参也走闸门（比如直接给了 0 或 99）
        for (const a of ALL_ATTRS) this.values[a] = clampAttr(this.values[a])
    }

    get(attr: AttrName): number {
        return this.values[attr]
    }

    set(attr: AttrName, value: number): void {
        this.values[attr] = clampAttr(value)
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

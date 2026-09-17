import { describe, it, expect } from 'vitest'
import { AttributeSet, ATTR_ABSOLUTE_MAX } from '../entities/attributes'

describe('AttributeSet', () => {
    it('should initialize with default values', () => {
        const attrs = new AttributeSet()
        expect(attrs.get('strength')).toBe(3)
        expect(attrs.get('vitality')).toBe(3)
        expect(attrs.total()).toBe(18)
    })

    it('should override defaults with provided values', () => {
        const attrs = new AttributeSet({ strength: 10, vitality: 14 })
        expect(attrs.get('strength')).toBe(10)
        expect(attrs.get('vitality')).toBe(14)
        expect(attrs.get('agility')).toBe(3)
    })

    it('should modify attribute by delta', () => {
        const attrs = new AttributeSet({ strength: 10 })
        attrs.modify('strength', 3)
        expect(attrs.get('strength')).toBe(13)
    })

    it('should clamp to absolute max', () => {
        const attrs = new AttributeSet({ strength: 28 })
        attrs.modify('strength', 5)
        expect(attrs.get('strength')).toBe(ATTR_ABSOLUTE_MAX)
    })

    it('地板与天花板都在写入时夹取，读时不钳制', () => {
        const attrs = new AttributeSet({ insight: 6 })
        attrs.modify('insight', -8)
        expect(attrs.get('insight')).toBe(3)
        // 地板挡住了损失，所以没有「坑」要填：加成直接生效
        attrs.modify('insight', 2)
        expect(attrs.get('insight')).toBe(5)
        attrs.modify('insight', 40)
        expect(attrs.get('insight')).toBe(ATTR_ABSOLUTE_MAX)
    })

    it('回滚能精确还原（写入即夹取，所以不会棘轮）', () => {
        const attrs = new AttributeSet({ agility: 20 })
        // 照 applyAttrMods 的记账方式：先记 before，写入，再算实际生效量
        const apply = (delta: number): number => {
            const before = attrs.get('agility')
            attrs.modify('agility', delta)
            return attrs.get('agility') - before
        }
        const applied = apply(-25) // 想压到 -5，被地板停在 3 → 实际 -17
        expect(attrs.get('agility')).toBe(3)
        expect(applied).toBe(-17)
        attrs.modify('agility', -applied) // 回滚实际生效量
        expect(attrs.get('agility')).toBe(20)
    })

    it('should clone correctly', () => {
        const attrs = new AttributeSet({ strength: 14, vitality: 12 })
        const cloned = attrs.clone()
        cloned.modify('strength', 2)
        expect(attrs.get('strength')).toBe(14)
        expect(cloned.get('strength')).toBe(16)
    })
})

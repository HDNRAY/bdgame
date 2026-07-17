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

    it('should allow values below minimum without floor', () => {
        const attrs = new AttributeSet({ strength: 2 })
        attrs.modify('strength', -5)
        expect(attrs.get('strength')).toBe(-3)
    })

    it('should respect minValues floor', () => {
        const attrs = new AttributeSet({ insight: 6 })
        attrs.minValues.insight = 3
        attrs.modify('insight', -8)
        expect(attrs.get('insight')).toBe(3)
        // buff 先填坑（被地板吸收的部分）再生效
        attrs.modify('insight', 2)
        expect(attrs.get('insight')).toBe(3)
        attrs.modify('insight', 6)
        expect(attrs.get('insight')).toBe(6)
    })

    it('should clone correctly', () => {
        const attrs = new AttributeSet({ strength: 14, vitality: 12 })
        const cloned = attrs.clone()
        cloned.modify('strength', 2)
        expect(attrs.get('strength')).toBe(14)
        expect(cloned.get('strength')).toBe(16)
    })
})

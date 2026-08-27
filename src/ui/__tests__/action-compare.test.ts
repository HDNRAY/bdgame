import { describe, it, expect } from 'vitest'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { getAction } from '../../data/actions'

/** 复刻 compare 的武器匹配逻辑 */
function matchWeapon(reqTags: string[]) {
    if (reqTags.length === 0) return null
    return STARTING_WEAPONS.find((w) => reqTags.every((t) => w.tags.includes(t))) ?? null
}

describe('ActionCompare 武器匹配', () => {
    it('无 requiredTags → 兜底中性空手(无属性加成)', () => {
        expect(matchWeapon([])).toBeNull()
    })

    it('unarmed 招式 → 空手(但 compare 用无属性版)', () => {
        const w = matchWeapon(['unarmed'])
        expect(w?.id).toBe('bare_hands')
    })

    it('slash 招式 → 桃木剑', () => {
        const w = matchWeapon(['slash'])
        expect(w?.id).toBe('peach_sword')
        expect(w?.range).toEqual([1, 3])
    })

    it('polearm 招式 → 齐眉棍', () => {
        const w = matchWeapon(['polearm'])
        expect(w?.id).toBe('qimei_staff')
    })

    it('pierce+melee → 长枪或匕首(都含)', () => {
        const w = matchWeapon(['pierce', 'melee'])
        expect(w).not.toBeNull()
        expect(w!.tags).toContain('pierce')
        expect(w!.tags).toContain('melee')
    })

    it('imperial 招式 → 御物武器', () => {
        const w = matchWeapon(['imperial'])
        expect(w?.tags).toContain('imperial')
    })

    it('六阳掌(unarmed)能匹配到武器', () => {
        const a = getAction('liu_yang_zhang')!
        const w = matchWeapon(a.requiredTags)
        expect(w?.tags).toContain('unarmed')
    })

    it('破狼竹枝类(polearm+blunt) → 齐眉棍', () => {
        const w = matchWeapon(['polearm', 'blunt'])
        expect(w?.id).toBe('qimei_staff')
    })
})

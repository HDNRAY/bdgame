import { describe, it, expect } from 'vitest'
import { Character, calcMaxHp } from '../entities/character'

function mc(
    id: string,
    name: string,
    attrs: Record<string, number> = {},
    moveIds: string[] = [],
    actionConfigs?: any[],
): Character {
    const rewards = moveIds.map((id) => ({
        type: 'action' as const,
        id,
        name: id,
        description: '',
        tags: [] as never[],
    }))
    return new Character({
        id,
        name,
        story: 'balanced',
        weapon: 'bare_hands',
        baseAttrs: attrs,
        rewards,
        actionConfigs,
    })
}

describe('calcMaxHp', () => {
    it('should calculate HP correctly', () => {
        expect(calcMaxHp(10)).toBe(200)
        expect(calcMaxHp(20)).toBe(380)
        expect(calcMaxHp(30)).toBe(560)
    })
})

describe('Character', () => {
    it('should create with default attributes', () => {
        const c = mc('test_1', '测试角色')
        expect(c.name).toBe('测试角色')
        expect(c.attrs.total()).toBe(20) // 18 base + 2 from bare_hands AGI buff
        expect(c.hp).toBe(calcMaxHp(3))
        expect(c.ap).toBe(5) // 3 + 3×0.5 = 4.5 → 5
    })

    it('should create with custom attributes', () => {
        const c = mc('test_2', '武者', { strength: 14, vitality: 12 })
        expect(c.attrs.get('strength')).toBe(14)
        expect(c.hp).toBe(calcMaxHp(12))
    })

    it('should handle damage and healing', () => {
        const c = mc('test_3', '坦克', { vitality: 20 })
        const fullHp = c.hp

        c.takeDamage(50)
        expect(c.hp).toBe(fullHp - 50)

        c.heal(20)
        expect(c.hp).toBe(fullHp - 30)

        c.takeDamage(1000)
        expect(c.hp).toBe(0)
        expect(c.isAlive()).toBe(false)
    })

    it('should handle AP spending', () => {
        const c = mc('test_4', '武者', { vitality: 14 })
        expect(c.maxAp).toBe(8) // 4 + 14×0.25 = 7.5 → 8
        expect(c.spendAp(3)).toBe(true)
        expect(c.ap).toBe(5)
        expect(c.spendAp(10)).toBe(false)
        expect(c.ap).toBe(5)

        c.resetAp()
        expect(c.ap).toBe(8)
    })

    it('should order actions by actionConfigs', () => {
        const c = mc(
            'test_order',
            '排序测试',
            { wisdom: 10 },
            ['thrust', 'jab', 'straight_punch', 'crushing_blow'],
            [{ actionId: 'straight_punch' }, { actionId: 'thrust' }, { actionId: 'jab' }],
        )
        expect(c.actions.length).toBeGreaterThanOrEqual(3)
        const ids = c.actions.map((a) => a.id)
        // straight_punch first, thrust second, jab third (others at end)
        expect(ids.indexOf('straight_punch')).toBeLessThan(ids.indexOf('thrust'))
        expect(ids.indexOf('thrust')).toBeLessThan(ids.indexOf('jab'))
    })

    it('should build triggers from actionConfigs', () => {
        const c = mc(
            'test_trig',
            '触发测试',
            { wisdom: 20 },
            ['thrust', 'jab'],
            [{ actionId: 'thrust' }, { actionId: 'jab', triggerId: 'on_dodge' }],
        )
        const trigs = c.triggers
        const jabTrig = trigs.find((t) => t.actionId === 'jab')
        expect(jabTrig).toBeDefined()
        expect(jabTrig!.condition.type).toBe('on_dodge')
    })

    it('should limit triggers by wisdom', () => {
        const c = mc(
            'test_lim',
            '槽位限制',
            { wisdom: 4 },
            ['thrust', 'jab', 'straight_punch'],
            [
                { actionId: 'thrust', triggerId: 'on_dodge' },
                { actionId: 'jab', triggerId: 'on_parry' },
                { actionId: 'straight_punch', triggerId: 'on_hit' },
            ],
        )
        // wisdom 4 → floor(4/4)=1 slot
        expect(c.triggers.filter((t) => t.actionId && t.condition.type !== 'battle_start').length).toBeLessThanOrEqual(
            2,
        )
    })

    it('getConfig returns correct config', () => {
        const c = mc('test_cfg', '配置测试', {}, ['thrust', 'jab'], [{ actionId: 'jab', conditionId: 'hp_below_50' }])
        expect(c.getConfig('jab')?.conditionId).toBe('hp_below_50')
        expect(c.getConfig('thrust')).toBeUndefined()
    })
})

import { describe, it, expect } from 'vitest'
import { rewardPool } from '../systems/roguelite/reward-pool'
import type { Reward } from '../entities/reward'

describe('rewardPool', () => {
    describe('getPool', () => {
        it('passive 池返回功法列表', () => {
            const pool = rewardPool.getPool('passive')
            expect(pool.length).toBeGreaterThan(10)
            pool.forEach((r) => {
                expect(r.type).toBe('passive')
                expect(r.id).toBeTruthy()
                expect(r.name).toBeTruthy()
            })
        })

        it('artifact 池返回奇物列表', () => {
            const pool = rewardPool.getPool('artifact')
            expect(pool.length).toBeGreaterThan(10)
            pool.forEach((r) => expect(r.type).toBe('artifact'))
        })

        it('action 池返回招式列表', () => {
            const pool = rewardPool.getPool('action')
            expect(pool.length).toBeGreaterThan(10)
            pool.forEach((r) => expect(r.type).toBe('action'))
        })

        it('weapon 池返回非初始武器列表', () => {
            const pool = rewardPool.getPool('weapon')
            expect(pool.length).toBeGreaterThan(5)
            pool.forEach((r) => expect(r.type).toBe('weapon'))
        })

        it('weapon 池不包含初始武器', () => {
            const pool = rewardPool.getPool('weapon')
            const ids = pool.map((r) => r.id)
            // 初始武器 ID
            expect(ids).not.toContain('bare_hands')
            expect(ids).not.toContain('qingfeng_jian')
            expect(ids).not.toContain('twin_swords')
        })
    })

    describe('pickChoices', () => {
        it('返回指定数量的候选', () => {
            const choices = rewardPool.pickChoices('passive', 3)
            expect(choices).toHaveLength(3)
        })

        it('排除已拥有的奖励', () => {
            const all = rewardPool.getPool('action')
            const exclude = [all[0].id, all[1].id]
            const choices = rewardPool.pickChoices('action', 3, exclude)
            expect(choices).toHaveLength(3)
            choices.forEach((c) => {
                expect(exclude).not.toContain(c.id)
            })
        })

        it('池子不够多时返回全部可用', () => {
            const pool = rewardPool.getPool('passive')
            const allIds = pool.map((r) => r.id)
            // 排除所有，应该返回 0
            const choices = rewardPool.pickChoices('passive', 3, allIds)
            expect(choices).toHaveLength(0)
        })
    })

    describe('meetsRequirements', () => {
        it('无门槛的奖励始终满足', () => {
            const reward = rewardPool.getPool('action')[0]
            expect(rewardPool.meetsRequirements(reward, { strength: 1 })).toBe(true)
        })

        it('属性达标时返回 true', () => {
            const reward = rewardPool.getPool('passive').find((r) => r.id === 'qiti_source')!
            expect(rewardPool.meetsRequirements(reward, { wisdom: 16 })).toBe(true)
        })

        it('属性不足时返回 false', () => {
            const reward = rewardPool.getPool('passive').find((r) => r.id === 'qiti_source')!
            expect(rewardPool.meetsRequirements(reward, { wisdom: 10 })).toBe(false)
        })
    })

    describe('validateChoices', () => {
        it('全部可用时返回 valid=全部, allBlocked=false', () => {
            const choices = rewardPool.pickChoices('action', 3)
            const { valid, allBlocked } = rewardPool.validateChoices(choices, { strength: 99 })
            expect(valid).toHaveLength(3)
            expect(allBlocked).toBe(false)
        })

        it('全部不可用时返回 allBlocked=true', () => {
            const mock: Reward = {
                id: 'test',
                name: '测试',
                type: 'weapon',
                tags: [],
                description: '',
                requireAttrsMin: { strength: 99 },
            }
            const { valid, allBlocked } = rewardPool.validateChoices([mock], { strength: 1 })
            expect(valid).toHaveLength(0)
            expect(allBlocked).toBe(true)
        })
    })
})

import { describe, it, expect } from 'vitest'
import { rewardPool } from '../../game/roguelite/reward-pool'
import type { RewardEntity } from '../../game/entities/reward'

describe('rewardPool', () => {
    describe('getPool', () => {
        it('passive 池返回功法列表', () => {
            const pool = rewardPool.getPool('passive')
            expect(pool.length).toBeGreaterThan(10)
            pool.forEach((r) => {
                expect(r.id).toBeTruthy()
                expect(r.name).toBeTruthy()
            })
        })

        it('artifact 池返回奇物列表', () => {
            const pool = rewardPool.getPool('artifact')
            expect(pool.length).toBeGreaterThan(10)
            pool.forEach((r) => {
                expect(r.id).toBeTruthy()
                expect(r.name).toBeTruthy()
            })
        })

        it('action 池返回招式列表（含 apCost）', () => {
            const pool = rewardPool.getPool('action')
            expect(pool.length).toBeGreaterThan(10)
            pool.forEach((r) => {
                expect(r.name).toBeTruthy()
                expect('apCost' in r).toBe(true)
            })
        })

        it('action 池只出可学招式：不含 internal 标签、不含下划线前缀', () => {
            const pool = rewardPool.getPool('action')
            for (const r of pool) {
                // 两道闸都不许漏：internal 标签（同时会屏蔽 AI）+ 下划线前缀（实现型/成对招式的实现招）
                expect(r.id.startsWith('_')).toBe(false)
                expect(r.tags.includes('internal')).toBe(false)
            }
            // 居合斩/纳刀须成对由「居合道」授予，单进池即是死招
            expect(pool.map((r) => r.id)).not.toContain('_iaijutsu_strike')
            expect(pool.map((r) => r.id)).not.toContain('_resheath')
        })

        it('weapon 池返回武器列表', () => {
            const pool = rewardPool.getPool('weapon')
            expect(pool.length).toBeGreaterThan(5)
            pool.forEach((r) => {
                expect(r.name).toBeTruthy()
            })
        })

        it('weapon 池只出 WEAPON_DB：不含起始武器、不含御物', () => {
            const pool = rewardPool.getPool('weapon')
            const ids = pool.map((r) => r.id)
            // 起始武器（赤手空拳/桃木剑/齐眉棍/长枪/军用匕首…）不进随机池
            expect(ids).not.toContain('bare_hands')
            expect(ids).not.toContain('peach_sword')
            expect(ids).not.toContain('qimei_staff')
            // 御物只通过事件获得
            expect(ids).not.toContain('floating_silk')
            expect(pool.length).toBeGreaterThan(5)
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
            const reward = rewardPool.getPool('passive').find((r) => r.id === 'fei_hua_shou')!
            expect(rewardPool.meetsRequirements(reward, { dexterity: 16 })).toBe(true)
        })

        it('属性不足时返回 false', () => {
            const reward = rewardPool.getPool('passive').find((r) => r.id === 'fei_hua_shou')!
            expect(rewardPool.meetsRequirements(reward, { dexterity: 10 })).toBe(false)
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
            const mock: RewardEntity = {
                id: 'test',
                name: '测试',
                tags: [],
                description: '',
                requireAttrsMin: { strength: 99 },
            } as RewardEntity
            const { valid, allBlocked } = rewardPool.validateChoices([mock], { strength: 1 })
            expect(valid).toHaveLength(0)
            expect(allBlocked).toBe(true)
        })
    })
})

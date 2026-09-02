import { describe, it, expect } from 'vitest'
import { BuffRegistry } from '../combat/utils/buff-registry'
import { forEachBuffOf } from '../combat/utils/buff-loop'

describe('BuffRegistry', () => {
    function mkRegistry(): BuffRegistry {
        const r = new BuffRegistry()
        // 造两层:一层带 onDealDamage,一层带 onHitChance
        r.register('on_dmg_buff::a', { restoreValue: 1 }, {
            id: 'on_dmg_buff',
            name: '增伤',
            description: '',
            tags: [],
        } as never)
        r.register('hit_buff::a', { restoreValue: 2 }, {
            id: 'hit_buff',
            name: '加命中',
            description: '',
            tags: [],
            onHitChance: () => 0.1,
        } as never)
        r.register('def_buff::b', { restoreValue: 1 }, {
            id: 'def_buff',
            name: '防御',
            description: '',
            tags: [],
            onDealDamage: () => 5,
        } as never)
        return r
    }

    it('set/entries 保持 Map 语义(真源)', () => {
        const r = mkRegistry()
        expect(r.size).toBe(3)
        expect(r.has('hit_buff::a')).toBe(true)
        expect([...r.keys()].sort()).toEqual(['def_buff::b', 'hit_buff::a', 'on_dmg_buff::a'])
    })

    it('forEachBuffOf 按 owner 直达(不回退全表)', () => {
        const r = mkRegistry()
        const seen: string[] = []
        forEachBuffOf(r, 'a', (_d, _l, buffId) => {
            seen.push(buffId)
            return undefined
        })
        expect(seen.sort()).toEqual(['hit_buff', 'on_dmg_buff'])
        expect(seen).not.toContain('def_buff')
    })

    it('hook 注册表:forEachHook 只遍历带该钩子的层', () => {
        const r = mkRegistry()
        const hitOwners: string[] = []
        r.forEachHook('onHitChance', undefined, (_def, _l, ownerId) => {
            hitOwners.push(ownerId)
            return undefined
        })
        expect(hitOwners).toEqual(['a'])
        // onDealDamage:只有 def_buff 有(挂在 b 上)
        const dmgOwners: string[] = []
        r.forEachHook('onDealDamage', undefined, (_def, _l, ownerId) => {
            dmgOwners.push(ownerId)
            return undefined
        })
        expect(dmgOwners).toEqual(['b'])
    })

    it('unregister 后 hook 注册与遍历同步消失', () => {
        const r = mkRegistry()
        expect(r.delete('hit_buff::a')).toBe(true)
        let hitCount = 0
        r.forEachHook('onHitChance', undefined, () => {
            hitCount++
            return undefined
        })
        expect(hitCount).toBe(0)
        expect(r.has('hit_buff::a')).toBe(false)
        expect(r.size).toBe(2)
    })

    it('cloneFor 只带目标角色层,且修改不污染真源', () => {
        // 用真实 buff def(带 onAbsorb 的炁盾等)建层,验证 cloneFor 后 resyncAllHooks 能补 hook
        const real = new BuffRegistry()
        real.register(
            'qi_shield::a',
            { restoreValue: 10 },
            { id: 'qi_shield', name: '炁盾', description: '', tags: [], onAbsorb: () => 10 } as never,
        )
        real.register(
            'heavy_load::b',
            { restoreValue: 1 },
            { id: 'heavy_load', name: '重器', description: '', tags: [] } as never,
        )
        const c = real.cloneFor(['a'])
        expect(c.size).toBe(1) // 只带 a 的层
        // 修改克隆不污染真源
        c.set('extra::a', { restoreValue: 1 })
        expect(c.size).toBe(2)
        expect(real.size).toBe(2)
        expect(real.has('extra::a')).toBe(false)
        // clone 默认不重建 hook 注册(沙盒走 forEachBuffOf/byOwner);resyncAllHooks 可补齐
        let hookCount = 0
        c.forEachHook('onAbsorb', undefined, () => {
            hookCount++
            return undefined
        })
        expect(hookCount).toBe(0)
        c.resyncAllHooks()
        hookCount = 0
        c.forEachHook('onAbsorb', undefined, () => {
            hookCount++
            return undefined
        })
        expect(hookCount).toBe(1)
        // forEachBuffOf 始终可用(走 byOwner)
        let seen = 0
        c.forEachBuffOf('a', () => {
            seen++
            return undefined
        })
        expect(seen).toBe(2)
    })

    it('无 :: 的 key(系统层)不进 byOwner 但仍存真源', () => {
        const r = new BuffRegistry()
        r.set('system_marker', { restoreValue: 1 })
        expect(r.has('system_marker')).toBe(true)
        // forEachBuffOf 不遍历它(无 owner)
        let seen = 0
        forEachBuffOf(r, 'a', () => {
            seen++
            return undefined
        })
        expect(seen).toBe(0)
        // cloneFor 也不带
        expect(r.cloneFor(['a']).size).toBe(0)
    })
})

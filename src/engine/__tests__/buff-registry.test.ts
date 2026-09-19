import { describe, it, expect } from 'vitest'
import { BuffRegistry } from '../combat/utils/buff-registry'
import { forEachBuffOf, forEachHookOf } from '../combat/utils/buff-loop'
import { getBuff } from '../../data/buffs'

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
        // 克隆自带 hook 注册（set 覆写按 key 解析 def 补登记；qi_shield 在真库中可解析）
        let hookCount = 0
        c.forEachHook('onAbsorb', undefined, () => {
            hookCount++
            return undefined
        })
        expect(hookCount).toBe(1)
        // resyncAllHooks 幂等：不产生重复条目（重复会让钩子触发两次）
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
    // ── 走桶遍历（forEachHook / forEachHookOf）：单钩子扫描改走桶的前提 ──
    // 注意：扫描路径按 key 用 getBuff 解析 def，桶里存的是登记时的 def —— 两边一致的前提是
    // 「key 能在真库里解析到同一个 def」（生产恒成立），所以这组用例用真 buff id 而不是 mock def。

    function mkRealRegistry(): BuffRegistry {
        const r = new BuffRegistry()
        r.register('li_wu_xu_fa::a', { restoreValue: 1 }, getBuff('li_wu_xu_fa')!)
        r.register('yan_qi::a', { restoreValue: 1 }, getBuff('yan_qi')!)
        r.register('qi_shield::b', { restoreValue: 1 }, getBuff('qi_shield')!)
        return r
    }

    it('forEachHookOf 与扫描结果一致（含 owner 过滤）', () => {
        const r = mkRealRegistry()
        const scanOf = (owner: string | undefined, hook: 'onHitChance' | 'onDealDamage' | 'onAbsorb'): string[] => {
            const out: string[] = []
            forEachBuffOf(r, owner ?? ['a', 'b'], (def, _l, _b, key) => {
                if (def?.[hook]) out.push(key)
            })
            return out.sort()
        }
        const bucketOf = (owner: string | undefined, hook: 'onHitChance' | 'onDealDamage' | 'onAbsorb'): string[] => {
            const out: string[] = []
            forEachHookOf(r, hook, owner, (_def, _l, _o, key) => {
                out.push(key)
            })
            return out.sort()
        }
        for (const hook of ['onHitChance', 'onDealDamage', 'onAbsorb'] as const) {
            expect(bucketOf('a', hook)).toEqual(scanOf('a', hook))
            expect(bucketOf(undefined, hook)).toEqual(scanOf(undefined, hook))
        }
        expect(bucketOf('a', 'onHitChance')).toEqual(['li_wu_xu_fa::a'])
        expect(bucketOf('b', 'onAbsorb')).toEqual(['qi_shield::b'])
    })

    it('裸 set 写入、def 带钩子的层也会登记进桶（否则走桶会漏层）', () => {
        const r = new BuffRegistry()
        // ciyuan_blade 的 def 带 onParryPenetration，历史上就是裸 set 写的
        r.set('ciyuan_blade::a', { restoreValue: 1 })
        const seen: string[] = []
        r.forEachHook('onParryPenetration', 'a', (_def, _l, _o, key) => {
            seen.push(key)
        })
        expect(seen).toEqual(['ciyuan_blade::a'])
        // 覆盖写同一 key 不产生重复登记（重复会让钩子触发两次）
        r.set('ciyuan_blade::a', { restoreValue: 2 })
        let count = 0
        r.forEachHook('onParryPenetration', 'a', () => {
            count++
        })
        expect(count).toBe(1)
        // 无 def 的散落层（追踪标记）不进桶，也不报错
        r.set('fumble_track::a', { restoreValue: 1 })
        expect(r.has('fumble_track::a')).toBe(true)
    })

    it('cloneFor 克隆带桶（沙盒里走桶的扫描能读到钩子）', () => {
        const c = mkRealRegistry().cloneFor(['a', 'b'])
        const keys: string[] = []
        c.forEachHook('onHitChance', 'a', (_def, _l, _o, key) => {
            keys.push(key)
        })
        expect(keys).toEqual(['li_wu_xu_fa::a'])
    })

    it('forEachHookOf 对裸 Map 退回扫描（测试/手搓 state）', () => {
        const pending = new Map<string, { restoreValue: number }>()
        pending.set('li_wu_xu_fa::a', { restoreValue: 1 })
        pending.set('qi_shield::b', { restoreValue: 1 })
        const keys: string[] = []
        forEachHookOf(pending as never, 'onHitChance', 'a', (_def, _l, _o, key) => {
            keys.push(key)
        })
        expect(keys).toEqual(['li_wu_xu_fa::a'])
    })
})

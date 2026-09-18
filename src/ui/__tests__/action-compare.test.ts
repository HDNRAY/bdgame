import { describe, it, expect } from 'vitest'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { allMainActions, getAction } from '../../data/actions'
import type { Tag } from '../../engine/entities/tag'
import { TAG_CN } from '../../bridge/tagDisplay'
import {
    collectTagOptions,
    filterActions,
    getCandidateActions,
    isSupportAction,
    parseTagParam,
} from '../screens/DevMode/ActionCompare/filter'

/** 复刻 compare 的武器匹配逻辑 */
function matchWeapon(reqTags: Tag[]) {
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

/** 复刻页面用的候选池与 tag 选项来源 */
const POOL = getCandidateActions(allMainActions)
const OPTIONS = collectTagOptions(POOL)

describe('ActionCompare 标签筛选（选项来源）', () => {
    it('候选池 = 主招去掉前置/后置辅助招', () => {
        expect(POOL).toHaveLength(allMainActions.length - allMainActions.filter(isSupportAction).length)
        expect(POOL.every((a) => !a.tags.includes('pre_action') && !a.tags.includes('post_action'))).toBe(true)
        expect(POOL.length).toBeGreaterThan(0)
    })

    it('选项只列候选池里实际出现过的 tag（不铺满 53 种）', () => {
        const inPool = new Set<Tag>(POOL.flatMap((a) => a.tags))
        expect(OPTIONS.length).toBeGreaterThan(0)
        expect(OPTIONS.length).toBeLessThan(53)
        for (const t of OPTIONS) expect(inPool.has(t)).toBe(true)
        // 反向：候选池里出现过的 tag 一个不漏
        expect([...inPool].every((t) => OPTIONS.includes(t))).toBe(true)
        // 被排除的辅助招专有 tag 不该出现（pre_action/post_action 只可能挂在被过滤掉的招上）
        expect(OPTIONS).not.toContain('pre_action')
        expect(OPTIONS).not.toContain('post_action')
    })

    it('选项按 tagDisplay 的中文名（zh）排序', () => {
        const sorted = [...OPTIONS].sort((x, y) => TAG_CN[x].localeCompare(TAG_CN[y], 'zh'))
        expect(OPTIONS).toEqual(sorted)
    })

    it('?tags= 解析丢弃脏值', () => {
        const valid = new Set<Tag>(OPTIONS)
        expect(parseTagParam(null, valid)).toEqual([])
        expect(parseTagParam('stun,paralyze', valid)).toEqual(['stun', 'paralyze'])
        expect(parseTagParam('stun,__bogus__,', valid)).toEqual(['stun'])
    })
})

describe('ActionCompare 筛选语义', () => {
    it('标签多选是 OR（命中任一即保留），不是 AND', () => {
        const stun = filterActions(POOL, { tags: ['stun'] })
        const para = filterActions(POOL, { tags: ['paralyze'] })
        const both = filterActions(POOL, { tags: ['stun', 'paralyze'] })
        // OR = 并集大小；AND 只会得到交集（更小，且丢掉只带其中一个 tag 的招）
        expect(both).toHaveLength(new Set([...stun, ...para].map((a) => a.id)).size)
        for (const a of stun) expect(both.some((b) => b.id === a.id)).toBe(true)
        for (const a of para) expect(both.some((b) => b.id === a.id)).toBe(true)
        // 返回的每一条都至少命中一个选中 tag
        expect(both.every((a) => a.tags.includes('stun') || a.tags.includes('paralyze'))).toBe(true)
    })

    it('不选 tag = 不过滤（全池返回）', () => {
        expect(filterActions(POOL, { tags: [] })).toHaveLength(POOL.length)
        expect(filterActions(POOL, {})).toHaveLength(POOL.length)
    })

    it('AP × 标签 × 搜索 串联（三者都生效）', () => {
        const ap2 = filterActions(POOL, { ap: [2] })
        const ap2Stun = filterActions(POOL, { ap: [2], tags: ['stun'] })
        expect(ap2Stun.every((a) => a.apCost === 2)).toBe(true)
        expect(ap2Stun.every((a) => a.tags.includes('stun'))).toBe(true)
        expect(ap2Stun.length).toBeLessThanOrEqual(ap2.length)
        // 搜索再叠加：只有名字命中「掌」的留下
        const narrowed = filterActions(POOL, { ap: [2], tags: ['stun'], query: '掌' })
        expect(narrowed.every((a) => a.name.includes('掌'))).toBe(true)
        expect(narrowed.length).toBeLessThanOrEqual(ap2Stun.length)
        // 搜索也能命中 tag 名（沿用原有搜索口径）
        expect(filterActions(POOL, { query: 'stun' }).length).toBeGreaterThan(0)
    })

    it('过滤不污染候选池（sort 不就地改原数组）', () => {
        const before = POOL.map((a) => a.id)
        filterActions(POOL, { tags: OPTIONS.slice(0, 2) }).sort((x, y) => y.apCost - x.apCost)
        expect(POOL.map((a) => a.id)).toEqual(before)
    })
})

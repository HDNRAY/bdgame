import { describe, it, expect } from 'vitest'
import { evaluateWhen } from '../entities/condition'
import { applyEffects, type EffectContext } from '../entities/effect'
import { buildNodeSpecs, resolveNode, weightedSample, emptyNodeSpecs } from '../roguelite/map-builder'
import type { NodeSpec } from '../entities/node-spec'
import { ALL_EVENTS } from '../../data/events/index'

function makeCtx(over: Partial<EffectContext> = {}): EffectContext {
    return {
        flags: {},
        build: {
            id: 'player',
            name: '你',
            weapon: 'bare_hands',
            baseAttrs: {},
            rewards: [],
        },
        unspentPoints: 0,
        injury: 0,
        nodeLog: [],
        ...over,
    }
}

describe('flag 条件（json-logic-engine 只读求值）', () => {
    it('等于/与/非/嵌套路径', () => {
        expect(evaluateWhen({ '==': [{ var: 'flags.story' }, 'sect'] }, { flags: { story: 'sect' } })).toBe(true)
        expect(evaluateWhen({ '==': [{ var: 'flags.story' }, 'sect'] }, { flags: { story: 'feud' } })).toBe(false)
        expect(
            evaluateWhen(
                {
                    and: [
                        { '==': [{ var: 'flags.weapon_one_handed' }, true] },
                        { '!': { var: 'flags.has_offhand' } },
                    ],
                },
                { flags: { weapon_one_handed: true } },
            ),
        ).toBe(true)
        expect(
            evaluateWhen(
                { and: [{ '==': [{ var: 'flags.weapon_one_handed' }, true] }, { '!': { var: 'flags.has_offhand' } }] },
                { flags: { weapon_one_handed: true, has_offhand: true } },
            ),
        ).toBe(false)
    })

    it('undefined 视为无条件', () => {
        expect(evaluateWhen(undefined, { flags: {} })).toBe(true)
    })

    it('非法表达式不崩溃，视为不满足', () => {
        expect(evaluateWhen({ 'not_a_real_op': 1 }, { flags: {} })).toBe(false)
    })
})

describe('效果（Effect DSL 写入层）', () => {
    it('set / setMany / add', () => {
        const ctx = makeCtx()
        applyEffects(ctx, [
            { kind: 'set', flag: 'a', to: true },
            { kind: 'setMany', flags: { story: 'feud', b: 1 } },
            { kind: 'add', flag: 'b', n: 2 },
        ])
        expect(ctx.flags).toEqual({ a: true, story: 'feud', b: 3 })
    })

    it('grant 给实体并挂载武器', () => {
        const ctx = makeCtx()
        applyEffects(ctx, [{ kind: 'grant', type: 'weapon', id: 'peach_sword' }])
        expect(ctx.build.weapon).toBe('peach_sword')
        expect(ctx.build.rewards).toHaveLength(1)
    })

    it('points 计入预算（count）与额外奖励（不 count）', () => {
        const ctx = makeCtx()
        applyEffects(ctx, [{ kind: 'points', n: 4, count: true }])
        expect(ctx.unspentPoints).toBe(4)
        expect(ctx.flags['points_granted']).toBe(1)
        applyEffects(ctx, [{ kind: 'points', n: 8 }]) // 额外（如天生道种奇物）
        expect(ctx.unspentPoints).toBe(12)
        expect(ctx.flags['points_granted']).toBe(1) // 不计入 16 次预算
    })

    it('heal 恢复伤势', () => {
        const ctx = makeCtx({ injury: 40 })
        applyEffects(ctx, [{ kind: 'heal', n: 15 }])
        expect(ctx.injury).toBe(25)
    })
})

describe('地图构建与渐进生成（map-builder）', () => {
    it('buildNodeSpecs 聚合所有 placement，生成 33 个节点槽', () => {
        const specs = buildNodeSpecs(ALL_EVENTS)
        expect(specs).toHaveLength(33)
        expect(specs[0].candidates.some((c) => c.eventId === 'pick_story')).toBe(true)
        // 斗炁大会固定节点
        expect(specs[22].candidates.some((c) => c.eventId === 'tournament_open')).toBe(true)
        expect(specs[32].candidates.some((c) => c.eventId === 'tournament_final')).toBe(true)
        // 通用池节点有 fallback 候选
        expect(specs[3].candidates.some((c) => c.fallback)).toBe(true)
    })

    it('resolveNode：故事专属节点在激活后直接开始，未激活时回退到池', () => {
        const specs = buildNodeSpecs(ALL_EVENTS)
        // sect 的 n16（故事专属）
        const n16 = specs[15]
        // 未激活 sect → 池候选
        const before = resolveNode(n16, {}, (id) => ({ label: id }))
        expect(before.mode).not.toBe('direct')
        // 激活 sect → 直接开始 sect_n16_reunion
        const after = resolveNode(n16, { story: 'sect' }, (id) => ({ label: id }))
        expect(after.mode).toBe('direct')
        if (after.mode === 'direct') expect(after.eventId).toBe('sect_n16_reunion')
    })

    it('resolveNode：多候选加权抽 ≤3', () => {
        const spec: NodeSpec = {
            candidates: [
                { eventId: 'a', weight: 1 },
                { eventId: 'b', weight: 1 },
                { eventId: 'c', weight: 1 },
                { eventId: 'd', weight: 1 },
            ],
        }
        const r = resolveNode(spec, {}, (id) => ({ label: id }))
        expect(r.mode).toBe('choice')
        if (r.mode === 'choice') {
            expect(r.options.length).toBeLessThanOrEqual(3)
            expect(r.options.length).toBeGreaterThanOrEqual(1)
        }
    })

    it('weightedSample 不重复抽取', () => {
        const picked = weightedSample([{ weight: 1 }, { weight: 1 }, { weight: 1 }], 3)
        expect(new Set(picked)).toHaveLength(3)
        expect(emptyNodeSpecs()).toHaveLength(33)
    })
})

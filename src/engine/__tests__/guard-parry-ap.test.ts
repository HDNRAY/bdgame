import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { applyDamage } from '../combat/effects/damage'
import { applyBuffLayer } from '../combat/utils/buff-apply'
import { getBuff } from '../../data/buffs'
import { getAction } from '../../data/actions'
import { planEvent } from '../ai'
import { notifyRegenChanged } from '../combat/utils/ap-regen'
import { rng } from '../util/rng'
import type { LogEvent } from '../combat/log-events'

function makeChar(id: string, name: string, rewards: { type: 'passive'; id: string }[] = []): Character {
    return new Character({
        id,
        name,
        weapon: 'peach_sword',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 8 },
        battleStyle: 'melee' as const,
        rewards: rewards.map((r) => ({ ...r, name: r.id, description: '', tags: [] })),
    })
}

const guardUp = getBuff('guard_up')!

describe('听潮式 · 招架回 1 AP', () => {
    it('守势 buff 定义：招架率 +50%、招架成功回 1 AP、招架即消耗（不设持续时间）', () => {
        expect(guardUp.onParryChance).toBeTypeOf('function')
        expect(guardUp.onParry).toBeTypeOf('function')
        expect(guardUp.onParryChance!({} as never)).toBeCloseTo(0.5)
        expect(guardUp.expiry).toEqual({ type: 'consumed', trigger: 'on_parry' })
    })

    it('招架成功：先回 1 AP + 重排下一动，随后守势才被消耗（状态消耗日志）', () => {
        const me = makeChar('A', '甲')
        const foe = makeChar('B', '乙')
        const engine = new BattleEngine(me, foe, 4, false)
        const state = engine.state
        const key = `guard_up::${me.id}`
        const action = getAction('light_slash')!
        applyBuffLayer(engine, { buff: guardUp, target: me, stacks: 1, tMs: 0 })
        const events: LogEvent[] = []
        engine.onLog((e) => events.push(e))
        // 推进到「她刚行动完、不在队首」的状态（队首时 recalcRegenDelay 会直接跳过）
        const planFn = (self: Character): ReturnType<typeof planEvent> => planEvent(self, state)
        for (let i = 0; i < 40 && state.turn.entries[0]?.id === me.id; i++) engine.runEvent(planFn as never)
        me.spendAp(3)
        const entry = state.turn.entries.find((e) => e.id === me.id)!
        expect(state.turn.entries[0]?.id).not.toBe(me.id)
        // 先做一次「不带招架回气」的重排作为基线，这样差值只归因于那 +1 AP
        notifyRegenChanged(state, me)
        const before = entry.nextActionAt
        const apBefore = me.ap
        const wastedBefore = me.res.apWasted

        // 招架率 ≈ 0.5 + 基础值，掷到成功为止（种子固定，结果确定）
        rng.seedMain(7)
        let parried = false
        for (let i = 0; i < 20 && !parried; i++) {
            const apNow = me.ap
            events.length = 0
            applyDamage({ raw: 1, target: me, attacker: foe, engine, source: action })
            parried = events.some((e) => e.type === 'check_parry' && e.result)
            if (!parried) me.gainAp(apNow - me.ap) // 没招架到就复原 AP，继续掷
        }

        expect(parried).toBe(true)
        expect(me.ap).toBeCloseTo(apBefore + 1) // 钩子跑在消耗之前，回气没丢
        expect(me.res.apWasted).toBe(wastedBefore) // 没被 cap 吃掉
        expect(entry.nextActionAt).toBeLessThan(before) // 下一动真的提前了
        expect(state.pendingBuffs.has(key)).toBe(false) // 招架即消耗
        expect(events.some((e) => e.type === 'system' && e.message.includes('状态消耗'))).toBe(true)
    })

    it('没招架到就不消耗：守势留着继续提供招架率', () => {
        const me = makeChar('A', '甲')
        const foe = makeChar('B', '乙')
        const engine = new BattleEngine(me, foe, 4, false)
        const key = `guard_up::${me.id}`
        applyBuffLayer(engine, { buff: guardUp, target: me, stacks: 1, tMs: 0 })
        const events: LogEvent[] = []
        engine.onLog((e) => events.push(e))
        // 招架率压到必不成功，验证「只有招架成功才消耗」
        const original = guardUp.onParryChance
        guardUp.onParryChance = () => -1
        rng.seedMain(11)
        applyDamage({ raw: 1, target: me, attacker: foe, engine, source: getAction('light_slash')! })
        guardUp.onParryChance = original
        expect(events.some((e) => e.type === 'check_parry' && e.result)).toBe(false)
        expect(engine.state.pendingBuffs.has(key)).toBe(true)
    })

    it('AP 已满时回气被记成浪费、也不重排', () => {
        const me = makeChar('A', '甲')
        const foe = makeChar('B', '乙')
        const engine = new BattleEngine(me, foe, 4, false)
        const state = engine.state
        me.ap = me.maxAp
        const entry = state.turn.entries.find((e) => e.id === me.id)!
        const before = entry.nextActionAt
        const wastedBefore = me.res.apWasted
        guardUp.onParry!({
            final: 0,
            raw: 0,
            target: me,
            attacker: foe,
            engine,
            state,
            layer: { restoreValue: 1, extra: {} },
        } as never)
        expect(me.ap).toBe(me.maxAp)
        expect(me.res.apWasted).toBeCloseTo(wastedBefore + 1)
        expect(entry.nextActionAt).toBe(before)
    })

    it('guard 招式补上了 canUse（已有守势时不再重复释放）', () => {
        const act = getAction('guard')!
        expect(act.canUse).toBeTypeOf('function')
        const me = makeChar('A', '甲')
        const foe = makeChar('B', '乙')
        const engine = new BattleEngine(me, foe, 4, false)
        expect(act.canUse!(me, engine.state)).toBe(true)
        engine.state.pendingBuffs.set(`guard_up::${me.id}`, { restoreValue: 1 })
        expect(act.canUse!(me, engine.state)).toBe(false)
    })
})
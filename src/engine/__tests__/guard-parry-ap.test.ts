import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'
import { getAction } from '../../data/actions'
import { planEvent } from '../ai'
import { notifyRegenChanged } from '../combat/utils/ap-regen'
import { rng } from '../util/rng'

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
const iceBuff = getBuff('elemental_immunity')!

describe('听潮式 · 招架回 1 AP', () => {
    it('守势 buff 定义：招架率 +50%、招架成功回 1 AP', () => {
        expect(guardUp.onParryChance).toBeTypeOf('function')
        expect(guardUp.onParry).toBeTypeOf('function')
        expect(guardUp.onParryChance!({} as never)).toBeCloseTo(0.5)
    })

    it('招架回 1 AP，并把下一次行动提前（重排后才不会在满槽时被 cap 浪费）', () => {
        const me = makeChar('A', '甲')
        const foe = makeChar('B', '乙')
        const engine = new BattleEngine(me, foe, 4, false)
        const state = engine.state
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

        guardUp.onParry!({
            final: 0,
            raw: 0,
            target: me,
            attacker: foe,
            engine,
            state,
            layer: { restoreValue: 1, extra: {} },
        } as never)

        expect(me.ap).toBeCloseTo(apBefore + 1)
        expect(me.res.apWasted).toBe(wastedBefore) // 没被 cap 吃掉
        expect(entry.nextActionAt).toBeLessThan(before) // 下一动真的提前了
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

describe('冰心诀 · 根骨+1', () => {
    it('带冰心的角色根骨 +1', () => {
        rng.seedMain(1)
        expect(getPassive('ice_heart')).toBeDefined()
        expect(iceBuff.attrMods?.vitality).toBe(1)
        const plain = makeChar('A', '甲')
        const withIce = makeChar('B', '乙', [{ type: 'passive', id: 'ice_heart' }])
        expect(withIce.attrs.get('vitality')).toBeCloseTo(plain.attrs.get('vitality') + 1)
    })
})

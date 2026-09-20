import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getAction } from '../../data/actions'
import { calcApRegenPerSec } from '../calc/damage'
import { calcEffectiveApRegenPerSec } from '../combat/utils/ap-regen'

function makeChar(id: string, name: string): Character {
    return new Character({
        id,
        name,
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 8 },
        battleStyle: 'mid' as const,
        rewards: [],
    })
}

describe('断炁 · AP 回复压制', () => {
    it('定义：additive 上限 3、8 秒、每层 AP 回复 -0.1/s', () => {
        const def = getBuff('duan_qi')!
        expect(def.stacking).toEqual({ type: 'additive', max: 3 })
        expect(def.expiry).toEqual({ type: 'duration', ms: 8000 })
        expect(def.apRegenPerSec!({ layer: { restoreValue: 1, extra: {} } } as never)).toBeCloseTo(-0.1)
        expect(def.apRegenPerSec!({ layer: { restoreValue: 3, extra: {} } } as never)).toBeCloseTo(-0.3)
    })

    it('叠层累减；净回复最多压到基础的 25%（不会 ≤0 冻住角色）', () => {
        const me = makeChar('A', '甲')
        const foe = makeChar('B', '乙')
        const engine = new BattleEngine(me, foe, 4, false)
        const base = calcApRegenPerSec(me.attrs.get('wisdom'))
        const set = (stacks: number) =>
            engine.state.pendingBuffs.set(`duan_qi::${me.id}`, { restoreValue: stacks, buffId: 'duan_qi' })
        expect(calcEffectiveApRegenPerSec(engine.state, me)).toBeCloseTo(base)
        set(1)
        expect(calcEffectiveApRegenPerSec(engine.state, me)).toBeCloseTo(base - 0.1)
        set(3)
        expect(calcEffectiveApRegenPerSec(engine.state, me)).toBeCloseTo(base - 0.3)
        // 超过上限的极端情况（未来改 max、或与其他减回复叠加）：地板兜住，净回复恒为正
        set(100)
        expect(calcEffectiveApRegenPerSec(engine.state, me)).toBeCloseTo(base * 0.25)
    })

    it('血滴子命中会挂断炁', () => {
        const def = getAction('blood_droplet')!
        expect(def.effects?.some((e) => e.type === 'add_debuff' && e.buffId === 'duan_qi')).toBe(true)
    })
})

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

const layer = (restoreValue = 1) => ({ restoreValue, extra: {} })

describe('紊乱 · AP 回复压制', () => {
    it('定义：独立叠层、5 秒、每层 AP 回复 -0.1/s', () => {
        const def = getBuff('wen_luan')!
        expect(def.stacking?.type).toBe('independent')
        expect(def.expiry).toEqual({ type: 'duration', ms: 5000 })
        expect(def.apRegenPerSec!({ layer: layer() } as never)).toBeCloseTo(-0.1)
        expect(def.apRegenPerSec!({ layer: layer(2) } as never)).toBeCloseTo(-0.2)
    })

    it('叠层累减；净回复最多压到基础上限的 25%（不会 ≤0 冻住角色）', () => {
        const me = makeChar('A', '甲')
        const foe = makeChar('B', '乙')
        const engine = new BattleEngine(me, foe, 4, false)
        const base = calcApRegenPerSec(me.attrs.get('wisdom'))
        let seq = 0
        const add = (n: number) => {
            for (let i = 0; i < n; i++) {
                engine.state.pendingBuffs.set(`wen_luan::${me.id}::${seq++}`, { restoreValue: 1, buffId: 'wen_luan' })
            }
        }
        expect(calcEffectiveApRegenPerSec(engine.state, me)).toBeCloseTo(base)
        add(1)
        expect(calcEffectiveApRegenPerSec(engine.state, me)).toBeCloseTo(base - 0.1)
        add(3)
        expect(calcEffectiveApRegenPerSec(engine.state, me)).toBeCloseTo(base - 0.4)
        add(100) // 独立叠层无上限：地板兜住，净回复恒为正
        expect(calcEffectiveApRegenPerSec(engine.state, me)).toBeCloseTo(base * 0.25)
    })

    it('血滴子命中会挂紊乱', () => {
        const def = getAction('blood_droplet')!
        expect(def.effects?.some((e) => e.type === 'add_debuff' && e.buffId === 'wen_luan')).toBe(true)
    })
})

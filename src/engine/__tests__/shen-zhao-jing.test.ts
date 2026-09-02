import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'
import { calcExtraApRegenPerSec } from '../combat/utils/ap-regen'

function makeChar(id: string, name: string, rewards: { type: 'passive'; id: string }[]): Character {
    return new Character({
        id, name, weapon: 'bare_hands',
        baseAttrs: { strength: 14, vitality: 20, agility: 12, dexterity: 12, insight: 14, wisdom: 4 },        battleStyle: 'clinch' as const,

        rewards: rewards.map((r) => ({ ...r, name: r.id, description: '', tags: [] })),
    })
}

describe('神照经', () => {
    it('功法/buff 定义齐全', () => {
        expect(getPassive('shen_zhao_jing')).toBeDefined()
        const buff = getBuff('shen_zhao_jing')!
        expect(buff.apRegenPerSec).toBeTypeOf('function')
    })

    it('血越少额外 AP 回复越快,满血 0,残血≈0.4', () => {
        const atk = makeChar('A', '甲', [{ type: 'passive', id: 'shen_zhao_jing' }])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const buff = getBuff('shen_zhao_jing')!
        const layer = { restoreValue: 1 }
        // 满血
        atk.hp = atk.maxHp
        expect(buff.apRegenPerSec!({ final: 0, raw: 0, target: atk, attacker: atk, state: engine.state, layer } as never)).toBe(0)
        // 半血 → 0.4 × 0.5 = 0.2
        atk.hp = atk.maxHp * 0.5
        const halfVal = buff.apRegenPerSec!({ final: 0, raw: 0, target: atk, attacker: atk, state: engine.state, layer } as never)
        expect(halfVal).toBeCloseTo(0.2)
        // 残血 10% → 0.4 × 0.9 = 0.36
        atk.hp = atk.maxHp * 0.1
        expect(buff.apRegenPerSec!({ final: 0, raw: 0, target: atk, attacker: atk, state: engine.state, layer } as never)).toBeCloseTo(0.36)
        // 接近 0 血 → 封顶 0.4
        atk.hp = 0.1
        expect(buff.apRegenPerSec!({ final: 0, raw: 0, target: atk, attacker: atk, state: engine.state, layer } as never)).toBeCloseTo(0.4)
    })

    it('通过引擎 calcExtraApRegenPerSec 贡献生效', () => {
        const atk = makeChar('A', '甲', [{ type: 'passive', id: 'shen_zhao_jing' }])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        atk.hp = atk.maxHp * 0.5
        const extra = calcExtraApRegenPerSec(engine.state, atk)
        expect(extra).toBeCloseTo(0.2)
    })
})

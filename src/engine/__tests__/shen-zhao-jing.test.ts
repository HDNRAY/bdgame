import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'
import { calcExtraApRegenPerSec } from '../combat/utils/ap-regen'

function makeChar(id: string, name: string, rewards: { type: 'passive'; id: string }[]): Character {
    return new Character({
        id, name, weapon: 'bare_hands',
        baseAttrs: { strength: 14, vitality: 20, agility: 12, dexterity: 12, insight: 14, wisdom: 4 },
        rewards,
    })
}

describe('神照经', () => {
    it('功法/buff 定义齐全', () => {
        expect(getPassive('shen_zhao_jing')).toBeDefined()
        const buff = getBuff('shen_zhao_jing')!
        expect(buff.apRegenPerSec).toBeTypeOf('function')
    })

    it('血越少额外 AP 回复越快,满血 0,残血≈0.5', () => {
        const atk = makeChar('A', '甲', [{ type: 'passive', id: 'shen_zhao_jing' }])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const buff = getBuff('shen_zhao_jing')!
        const layer = { restoreValue: 1 }
        // 满血
        atk.hp = atk.maxHp
        expect(buff.apRegenPerSec!({ final: 0, raw: 0, target: atk, attacker: atk, state: engine.state, layer } as never)).toBe(0)
        // 半血
        atk.hp = atk.maxHp * 0.5
        console.log('half hp:', atk.hp, 'maxHp:', atk.maxHp, 'ratio:', atk.hp/atk.maxHp)
        const halfVal = buff.apRegenPerSec!({ final: 0, raw: 0, target: atk, attacker: atk, state: engine.state, layer } as never)
        console.log('half val:', halfVal, 'target hp:', atk.hp, 'maxHp:', atk.maxHp, 'ratio:', atk.hp / atk.maxHp)
        expect(halfVal).toBeCloseTo(0.25)
        // 残血 10%
        atk.hp = atk.maxHp * 0.1
        expect(buff.apRegenPerSec!({ final: 0, raw: 0, target: atk, attacker: atk, state: engine.state, layer } as never)).toBeCloseTo(0.45)
        // 接近 0 血 → 封顶 0.5
        atk.hp = 0.1
        expect(buff.apRegenPerSec!({ final: 0, raw: 0, target: atk, attacker: atk, state: engine.state, layer } as never)).toBeCloseTo(0.5)
    })

    it('通过引擎 calcExtraApRegenPerSec 贡献生效', () => {
        const atk = makeChar('A', '甲', [{ type: 'passive', id: 'shen_zhao_jing' }])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        atk.hp = atk.maxHp * 0.5
        const extra = calcExtraApRegenPerSec(engine.state, atk)
        expect(extra).toBeCloseTo(0.25)
    })
})

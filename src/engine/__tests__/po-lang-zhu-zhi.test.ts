import { describe, it, expect, beforeEach } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { seedBattleRandom } from './seed-battle-random'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

const buff = getBuff('po_lang_zhu_zhi_buff')!

function makeChar(id: string, name: string, chan: number): Character {
    const c = new Character({
        id,
        name,
        weapon: 'po_lang_zhu_zhi',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 12, insight: 10, wisdom: 8 },
        battleStyle: 'melee' as const,
        rewards: [],
    })
    c.chan = chan
    return c
}

/** 走一次 onParryReduction（招架段减伤），返回扣完的伤害 */
function reduce(chan: number, final: number): { damage: number; chanLeft: number } {
    const me = makeChar('A', '甲', chan)
    const foe = makeChar('B', '乙', 0)
    const engine = new BattleEngine(me, foe, 4, false)
    const damage = buff.onParryReduction!({
        final,
        raw: final,
        target: me,
        attacker: foe,
        engine,
        state: engine.state,
        layer: { restoreValue: 1, extra: {} },
    })
    return { damage, chanLeft: me.chan }
}

describe('破狼竹枝 · 招架减伤要付缠劲', () => {
    it('有缠劲：扣 1 缠、减免 3 点', () => {
        expect(reduce(3, 10)).toEqual({ damage: 7, chanLeft: 2 })
        expect(reduce(1, 10)).toEqual({ damage: 7, chanLeft: 0 })
    })

    it('缠劲为 0：不扣也不减（维持原伤害）', () => {
        expect(reduce(0, 10)).toEqual({ damage: 10, chanLeft: 0 })
    })

    it('伤害不足 3 点：减到 0 为止，不出现负伤害', () => {
        expect(reduce(2, 2)).toEqual({ damage: 0, chanLeft: 1 })
    })
})

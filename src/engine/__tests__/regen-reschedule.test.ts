import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { notifyRegenChanged } from '../combat/utils/ap-regen'
import { calcApRegenPerSec } from '../calc/damage'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

function makeChar(id: string): Character {
    return new Character({
        id,
        name: id,
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
        battleStyle: 'clinch',
        rewards: [],
    })
}

/**
 * 惰性 AP 下重排行动时间：`char.ap` 只在行动那一刻结算，进度编码在 `nextActionAt` 里。
 * 所以重排必须把「上次结算到现在的回复」投影出来再算剩余 —— 否则每次推演/回复率变动都会
 * 凭空推迟一次行动（推演被反复改动的角色会明显变慢）。
 */
describe('AP 回复率变化时的行动时间重排', () => {
    const RATE = calcApRegenPerSec(10)

    function setup(currentTime = 1000) {
        const a = makeChar('A')
        const b = makeChar('B')
        const engine = new BattleEngine(a, b, 4)
        const tm = engine.state.turn
        const eB = tm.entries.find((e) => e.id === 'B')!
        tm.entries.find((e) => e.id === 'A')!.nextActionAt = 500
        b.ap = b.maxAp - 4 // 还需 4 点
        b.lastActionEndMs = 0
        b.lastApUpdate = 0
        eB.nextActionAt = Math.ceil((4 / RATE) * 1000) // 与真实速率自洽的排期
        tm.setTime(currentTime)
        return { engine, tm, b, eB }
    }

    it('速率不变：重排后行动时间不变，且反复重排是幂等的', () => {
        const { tm, b, eB } = setup()
        const expected = 1000 + Math.ceil(((4 - RATE) / RATE) * 1000)
        tm.recalcRegenDelay(b, RATE)
        expect(eB.nextActionAt).toBe(expected)
        tm.recalcRegenDelay(b, RATE)
        expect(eB.nextActionAt).toBe(expected) // 再排一次不该继续往后推
        tm.recalcRegenDelay(b, RATE)
        expect(eB.nextActionAt).toBe(expected)
    })

    it('速率下调：已攒的那一段保留，只把剩下的按新速率排（不是从头再等一遍）', () => {
        const { tm, b, eB } = setup()
        tm.recalcRegenDelay(b, RATE / 2)
        expect(eB.nextActionAt).toBe(1000 + Math.ceil(((4 - RATE / 2) / (RATE / 2)) * 1000))
        expect(eB.nextActionAt).toBeGreaterThan(1000 + Math.ceil((4 / RATE) * 1000))
    })

    it('速率上调：剩下的提前', () => {
        const { tm, b, eB } = setup()
        tm.recalcRegenDelay(b, RATE * 2)
        expect(eB.nextActionAt).toBe(1000 + Math.ceil(((4 - RATE * 2) / (RATE * 2)) * 1000))
        expect(eB.nextActionAt).toBeLessThan(1000 + Math.ceil((4 / RATE) * 1000))
    })

    it('notifyRegenChanged 走同一条路：推演不变则原地不动，推演下调才推后且幂等', () => {
        const { engine, b, eB } = setup()
        const before = eB.nextActionAt
        notifyRegenChanged(engine.state, b)
        expect(eB.nextActionAt).toBe(before) // 推演没变 → 时间不变

        b.attrs.set('wisdom', 1)
        notifyRegenChanged(engine.state, b)
        const lowered = eB.nextActionAt
        expect(lowered).toBeGreaterThan(before) // 推演降了 → 剩下的一截按新速率排，推后
        notifyRegenChanged(engine.state, b)
        expect(eB.nextActionAt).toBe(lowered) // 同一个时间点再排：幂等
    })
})

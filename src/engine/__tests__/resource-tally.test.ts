import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { emptyResourceTally } from '../entities/resource-tally'
import { runBattle } from '../battle-runner'
import { gen, LUEYING, TANGROU, XUNXIANG } from '../../data/opponents/index'
import { MAX_CHAN } from '../constants'

function makeChar(id = 'test'): Character {
    return new Character({
        id,
        name: id,
        story: 'balanced',
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
        battleStyle: 'clinch' as const,
        rewards: [],
    })
}

describe('资源流水记账（Character.res）', () => {
    it('消耗 / 被扣 / 回复 / 浪费 / 溢出 各自归类', () => {
        const c = makeChar()
        const r = c.res
        c.ap = c.maxAp
        c.gainAp(5)
        expect([r.apGained, r.apWasted]).toEqual([0, 5]) // 满内息时回复全浪费

        c.spendAp(3)
        expect(r.apSpent).toBe(3)
        expect(r.chanGained).toBe(3) // 花内息换缠劲

        c.reduceAp(2)
        expect(r.apDrained).toBe(2)
        expect(r.apSpent).toBe(3) // 被扣不算主动消耗

        c.chan = MAX_CHAN - 1
        const overflow = c.addChan(4)
        expect(overflow).toBe(3)
        expect(r.chanGained).toBe(3 + 1)
        expect(r.chanOverflow).toBe(3)

        expect(c.spendChan(100)).toBe(false)
        expect(r.chanSpent).toBe(0)
        expect(c.spendChan(2)).toBe(true)
        expect(r.chanSpent).toBe(2)
    })

    it('gainAp 传负数（净回复被压低）记为消耗，不记为获得', () => {
        const c = makeChar()
        c.ap = 5
        const delta = c.gainAp(-2)
        expect(delta).toBe(-2)
        expect(c.res.apDrained).toBe(2)
        expect(c.res.apGained).toBe(0)
        // 压低到 0 以下仍是 0，多出来的部分不记账
        c.ap = 1
        c.gainAp(-5)
        expect(c.ap).toBe(0)
        expect(c.res.apDrained).toBe(3)
    })

    it('推演沙盘（forkForSim）不污染真实角色的流水', () => {
        const c = makeChar()
        c.chan = 10
        const sandbox = c.forkForSim()
        sandbox.spendChan(4)
        sandbox.spendAp(2) // 花内息也换缠劲
        expect(sandbox.chan).toBe(8)
        expect(c.chan).toBe(10) // 写入落自身
        expect(c.res.chanSpent).toBe(0)
        expect(c.res.apSpent).toBe(0)
        expect(sandbox.res.chanSpent).toBe(4)
    })
})

describe('资源流水对账（真实战斗）', () => {
    const ids = [LUEYING, XUNXIANG, TANGROU]

    it('初值 + 获得 − 消耗 − 被扣 = 终值（内息与缠劲都成立），且与统计快照一致', () => {
        for (const id of ids) {
            const base = new Character(gen(id, 33))
            const opp = new Character(gen(id === XUNXIANG ? LUEYING : XUNXIANG, 33))
            const { engine } = runBattle(base, opp, undefined, 4, true, { statsLevel: 2 })
            const stats = engine.stats!
            for (const c of engine.state.characters) {
                const r = c.res
                const apExpect = c.maxAp * 0.5 + r.apGained - r.apSpent - r.apDrained
                expect(r.apSpent).toBeGreaterThan(0)
                expect(r.apGained).toBeGreaterThan(0)
                expect(Math.abs(apExpect - c.ap)).toBeLessThan(0.11)
                expect(Math.abs(r.chanGained - r.chanSpent - c.chan)).toBeLessThan(0.11)
                // 快照里的总账就是角色自己的账（不是从事件里猜的）
                expect(stats.chars.get(c.id)!.res).toEqual(r)
            }
        }
    })

    it('武器自扣的缠劲也算进总账（特种兵匕首：命中即耗 1 缠）', () => {
        const base = new Character(gen(LUEYING, 33))
        const opp = new Character(gen(XUNXIANG, 33))
        const { engine } = runBattle(base, opp, undefined, 4, true, { statsLevel: 2 })
        const lu = engine.state.characters.find((c) => c.name === '李雪影')!
        expect(lu.res.chanSpent).toBeGreaterThan(0)
    })
})

describe('emptyResourceTally', () => {
    it('每次都是新对象（不能被两场战斗共享）', () => {
        expect(emptyResourceTally()).not.toBe(emptyResourceTally())
    })
})

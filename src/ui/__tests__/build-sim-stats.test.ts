import { describe, it, expect } from 'vitest'
import { runSeries } from '../screens/DevMode/BuildSim/sim-core'
import { BattleStats, type BattleStatsSnapshot } from '../../engine/combat/battle-stats'
import type { CharacterBuild } from '../../game/entities/character-build'

const build: CharacterBuild = {
    id: 'player',
    name: '构筑',
    story: '',
    battleStyle: 'clinch',
    weapon: 'bare_hands',
    baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
    rewards: [],
    actionConfigs: [],
}

describe('构筑试炼的统计接入', () => {
    it('每个对手的结果带一份 N 场统计快照（可结构化克隆，worker 才能传）', () => {
        const r = runSeries(build, { opponentId: 'fanglie', n: 3, level: 33 })
        expect(r.done).toBe(3)
        expect(r.stats).toBeDefined()
        expect(r.stats!.battles).toBe(3)
        expect(r.stats!.level).toBe(2)
        // 我方在快照里必须有账号（承伤/资源都对得上）
        const self = r.stats!.chars.find((c) => c.id === 'player')!
        expect(self).toBeDefined()
        expect(self.res.apSpent).toBeGreaterThan(0)
        // worker postMessage 走结构化克隆：快照里不能有 Map / class 实例
        expect(() => structuredClone(r.stats)).not.toThrow()
    })

    it('对手不存在时不产出统计（不炸）', () => {
        const r = runSeries(build, { opponentId: '__nope__', n: 3, level: 33 })
        expect(r.done).toBe(0)
        expect(r.stats).toBeUndefined()
    })

    it('多对手快照能合并成整体统计（面板消费的形态）', () => {
        const a = runSeries(build, { opponentId: 'fanglie', n: 2, level: 33 })
        const b = runSeries(build, { opponentId: 'tangrou', n: 2, level: 33 })
        const merged = BattleStats.mergeSnapshots(
            [a.stats, b.stats].filter((s): s is BattleStatsSnapshot => !!s),
        ).snapshot()
        expect(merged.battles).toBe(4)
        const self = merged.chars.find((c) => c.id === 'player')!
        expect(self.res.apSpent + self.taken).toBeGreaterThan(0)
    })
})

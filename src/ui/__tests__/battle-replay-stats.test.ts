import { describe, it, expect } from 'vitest'
import { buildBattleDataFromEntries } from '../../ui/components/roguelite/battle-replay'
import type { BattleStatsSnapshot } from '../../engine/combat/battle-stats'

/**
 * 肉鸽回放要带上本场统计：回合结算里 `getBattleReplay()` 产出的 stats 透传到 BattlePanel，
 * 底部「统计」页签才显示得出（单挑模式是 BattlePanel 自己跑一场并带统计）。
 */
describe('肉鸽回放 → BattleData 的统据统计', () => {
    it('replay.stats 透传进 BattleData.stats', () => {
        const stats: BattleStatsSnapshot = { level: 2, battles: 1, chars: [] }
        const data = buildBattleDataFromEntries(
            { entries: [], stats },
            { id: 'a', name: '甲' },
            { id: 'b', name: '乙' },
        )
        expect(data.stats).toBe(stats)
        expect(data.charAInfo.id).toBe('a')
        expect(data.charBInfo.name).toBe('乙')
    })

    it('没有统计时不报错（缺省不显示统计页签）', () => {
        const data = buildBattleDataFromEntries(
            { entries: [] },
            { id: 'a', name: '甲' },
            { id: 'b', name: '乙' },
        )
        expect(data.stats).toBeUndefined()
    })
})

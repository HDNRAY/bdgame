import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BattleStatsPanel } from '../components/BattleStatsPanel/BattleStatsPanel'
import { runSeries } from '../screens/DevMode/BuildSim/sim-core'
import type { CharacterBuild } from '../../game/entities/character-build'

const build: CharacterBuild = {
    id: 'player',
    name: '构筑',
    story: '',
    battleStyle: 'clinch',
    weapon: 'bare_hands',
    baseAttrs: { strength: 10, vitality: 10, courage: 10, dexterity: 10, insight: 10, wisdom: 10 } as CharacterBuild['baseAttrs'],
    rewards: [],
    actionConfigs: [],
}

/** 面板是纯展示组件：这里只保证「真数据能渲染出来、关键分区都在」，不测像素 */
describe('BattleStatsPanel 渲染', () => {
    const snap = runSeries(build, { opponentId: 'fanglie', n: 2, level: 33 }).stats!
    const names = { player: '我方', fanglie: '方烈' }

    it('默认概览：双方名字 + 关键指标都在，且不显示内部 id', () => {
        const html = renderToStaticMarkup(<BattleStatsPanel snapshot={snap} names={names} selfId="player" title="vs 方烈" />)
        expect(html).toContain('vs 方烈')
        expect(html).toContain('我方')
        expect(html).toContain('方烈')
        expect(html).toContain('命中率')
        expect(html).toContain('缠劲消耗/场')
        expect(html).toContain('2 场合计')
        // 内部 actionId 不该出现在界面上（只给招式名）
        expect(html).not.toContain('bare_hands')
    })

    it('输出 / 承伤 / 资源三个分页的默认态都能渲染', () => {
        for (const tab of ['offense', 'defense', 'resource'] as const) {
            const html = renderToStaticMarkup(
                <BattleStatsPanel snapshot={snap} names={names} selfId="player" defaultTab={tab} />,
            )
            expect(html.length).toBeGreaterThan(0)
        }
    })

    it('空快照不炸', () => {
        const html = renderToStaticMarkup(
            <BattleStatsPanel snapshot={{ level: 2, battles: 0, chars: [] }} names={names} />,
        )
        expect(html).toContain('无统计数据')
    })
})

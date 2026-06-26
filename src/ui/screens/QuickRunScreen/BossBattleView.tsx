import { useMemo } from 'react'
import { BattlePanel } from '../../components/BattlePanel/BattlePanel'
import { getOpponentDef, gen } from '../../../engine/data/opponents/index'
import { getWeapon } from '../../../engine/data/weapons/weapons'
import type { GameRun } from '../../../engine/systems/game-run'

interface BossBattleViewProps {
    run: React.MutableRefObject<GameRun>
    phase: 'intro' | 'battle' | null
    onStart: () => void
    onExit: () => void
}

export function BossBattleView({ run, phase, onStart, onExit }: BossBattleViewProps) {
    const node = run.current.getCurrentNode()
    const bossMap: Record<number, string> = { 11: 'boss_phase1', 22: 'boss_phase2', 33: 'boss_final' }
    const bossEventId = bossMap[node.index] ?? 'zhanglie'
    const bossDef = getOpponentDef(bossEventId)
    const enemyBuild = useMemo(() => (bossDef ? gen(bossDef, node.index) : null), [bossDef, node.index])

    if (phase === 'battle' && enemyBuild) {
        return (
            <div className="boss-battle-wrapper">
                <div className="boss-battle-bar">
                    <button className="qr-header-btn" onClick={onExit}>
                        ← 退出战斗
                    </button>
                </div>
                <BattlePanel buildA={run.current.state.build} buildB={enemyBuild} showSidePanels={false} />
            </div>
        )
    }

    return (
        <div className="boss-intro">
            <div className="boss-intro-card">
                <h2 className="boss-intro-title">⚠ BOSS 战</h2>
                <p className="boss-intro-enemy">
                    对手: <strong>{bossDef?.name ?? bossEventId}</strong>
                </p>
                <p className="boss-intro-desc">{bossDef?.story ?? '一场生死对决'}</p>
                <div className="boss-intro-stats">
                    <div>等级: n={node.index}</div>
                    <div>武器: {bossDef ? (getWeapon(bossDef.weapon)?.name ?? bossDef.weapon) : '-'}</div>
                </div>
                <button className="qr-btn" onClick={onStart}>
                    开始战斗
                </button>
            </div>
        </div>
    )
}

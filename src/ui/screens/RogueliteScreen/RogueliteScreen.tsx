import { useRogueliteStore } from '../../stores/roguelite-store'
import { useOrientation } from '../../hooks/useOrientation'
import { useNavigate } from 'react-router-dom'
import { CharacterPanel } from '../../components/CharacterPanel/CharacterPanel'
import { NodeMap } from '../../components/roguelite/NodeMap'
import { InjuryBar } from '../../components/roguelite/InjuryBar'
import { RoundCard } from '../../components/roguelite/RoundCard'
import './RogueliteScreen.scss'

export function RogueliteScreen() {
    const { gameState, mode, select, setMode, saveBuild, reset } = useRogueliteStore()
    const { isLandscape } = useOrientation()
    const navigate = useNavigate()

    function handleExit() {
        reset()
        navigate('/')
    }

    if (!gameState) return null

    if (gameState.finished) {
        return (
            <div className="rs rs-finish">
                <h1>通关</h1>
                <p>伤势: {gameState.injury}</p>
                <p>获得: {gameState.build.rewards.length} 个奖励</p>
                <button className="rs-btn" onClick={reset}>
                    再来一局
                </button>
                <button className="rs-btn" onClick={() => navigate('/')}>
                    返回主菜单
                </button>
            </div>
        )
    }

    return (
        <div className={`rs ${isLandscape ? 'rs-landscape' : 'rs-portrait'}`}>
            <header className="rs-header">
                <NodeMap nodeIndex={gameState.nodeIndex} />
                <InjuryBar injury={gameState.injury} />
                <span className={`rs-points${gameState.unspentPoints > 0 ? '' : ' rs-points-zero'}`}>
                    修炼点 {gameState.unspentPoints}
                </span>
                <span className="rs-title">斗炁大会</span>
                <button className="rs-exit-btn" onClick={handleExit}>
                    退出
                </button>
            </header>
            <div className="rs-body">
                <div className="rs-rounds">
                    {gameState.rounds.map((r, i) => (
                        <RoundCard key={i} round={r} past={i < gameState.rounds.length - 1} onChoice={select} />
                    ))}
                </div>
                {mode === 'build' && <div className="rs-overlay" />}
                <div className={`rs-sidebar rs-${mode}`}>
                    {mode === 'view' && (
                        <button className="rs-prep-btn" onClick={() => setMode('build')}>
                            备 战
                        </button>
                    )}
                    <div className="rs-panel-wrapper">
                        <CharacterPanel
                            mode={mode}
                            build={gameState.build}
                            unspentCultPoints={gameState.unspentPoints}
                            onSave={saveBuild}
                            onBack={() => setMode('view')}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

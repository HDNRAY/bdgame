import { useRogueliteStore } from '../../stores/roguelite-store'
import { useOrientation } from '../../hooks/useOrientation'
import { CharacterPanel } from '../../components/CharacterPanel/CharacterPanel'
import { NodeMap } from '../../components/roguelite/NodeMap'
import { InjuryBar } from '../../components/roguelite/InjuryBar'
import { RoundCard } from '../../components/roguelite/RoundCard'
import './RogueliteScreen.scss'

export function RogueliteScreen() {
    const { gameState, mode, select, reset } = useRogueliteStore()
    const { isLandscape } = useOrientation()

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
            </div>
        )
    }

    return (
        <div className={`rs ${isLandscape ? 'rs-landscape' : 'rs-portrait'}`}>
            <header className="rs-header">
                <NodeMap nodeIndex={gameState.nodeIndex} />
                <InjuryBar injury={gameState.injury} />
            </header>
            <div className="rs-body">
                <div className="rs-rounds">
                    {gameState.rounds.map((r, i) => (
                        <RoundCard key={i} round={r} past={i < gameState.rounds.length - 1} onChoice={select} />
                    ))}
                </div>
                <CharacterPanel mode={mode} build={gameState.build} />
            </div>
        </div>
    )
}

import { useCallback } from 'react'
import { Character } from '../../../engine/entities/character'
import { runBattle } from '../../../engine/battle-runner'
import { getOpponentDef, gen } from '../../../engine/data/opponents/index'
import type { CharacterBuild } from '../../../engine/entities/character-build'

interface SparScreenProps {
    playerBuild: CharacterBuild
    onBack: () => void
}

export function SparScreen({ playerBuild, onBack }: SparScreenProps) {
    const n = 11
    const def = getOpponentDef('zhanglie')
    const opponentBuild = def ? gen(def, n) : null
    const handleFight = useCallback(() => {
        if (!opponentBuild) return
        const a = new Character(playerBuild)
        const b = new Character(opponentBuild)
        const { engine } = runBattle(a, b, undefined, 6)
        const chars = engine.state.characters
        const winner = engine.state.lastWinner
        alert(
            `${winner ?? '平局'} 获胜!\n玩家 HP: ${chars[0].hp}/${chars[0].maxHp}\n张烈 HP: ${chars[1].hp}/${chars[1].maxHp}`,
        )
    }, [playerBuild, opponentBuild])
    if (!opponentBuild) return <div>对手数据错误</div>
    return (
        <div className="spar-panel">
            <h3>切磋 — 铁枪·张烈 (n={n})</h3>
            <div className="spar-stats">
                <div>
                    <strong>{playerBuild.name ?? '玩家'}</strong>
                    <br />
                    招式: {playerBuild.rewards.length} | 武器: {playerBuild.weapon}
                </div>
                <div>
                    <strong>铁枪·张烈</strong>
                </div>
            </div>
            <button className="qr-btn" onClick={handleFight}>
                开战
            </button>
            <button className="qr-btn qr-btn-secondary" onClick={onBack}>
                返回
            </button>
        </div>
    )
}

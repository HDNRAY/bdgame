import type { BattleSnapshot } from '../../../engine/combat/types'
import { getBuff } from '../../../engine/data/buffs'
import { Tooltip } from '../ui/Tooltip/Tooltip'
import './BattlePanel.scss'

interface BattlePanelProps {
    snapshot: BattleSnapshot
    charAName: string
    charBName: string
}

export function BattlePanel({ snapshot, charAName, charBName }: BattlePanelProps) {
    const [a, b] = snapshot.characters
    const dist = snapshot.distance
    const isFinished = snapshot.phase === 'finished'
    const winner = isFinished ? (a.hp > 0 ? charAName : charBName) : null

    /** 查角色的缠层数 */
    return (
        <div className="battle-panel">
            <div className="title">
                <span className="char-a">{charAName}</span> vs <span className="char-b">{charBName}</span>
            </div>

            <div className="distance">
                {'─'.repeat(8)} {dist.toFixed(1)}m {'─'.repeat(8)}
            </div>

            {winner && <div className="winner">🏆 {winner} 获胜！</div>}

            <div className="chars">
                {[a, b].map((c, i) => {
                    const hpPct = c.maxHp > 0 ? (c.hp / c.maxHp) * 100 : 0
                    const apPct = c.maxAp > 0 ? (c.ap / c.maxAp) * 100 : 0
                    return (
                        <div key={c.id} className="char-col">
                            <div className="label" style={{ color: i === 0 ? '#4ecdc4' : '#ff6b6b' }}>
                                {i === 0 ? charAName : charBName}
                            </div>
                            <div className="hp-text">
                                <span className="hp-label">HP</span> {Math.round(c.hp)}/{c.maxHp}
                            </div>
                            <div className="bar-bg">
                                <div
                                    className={`bar-fill ${hpPct > 30 ? 'bar-hp' : 'bar-hp-low'}`}
                                    style={{ width: `${Math.min(100, hpPct)}%` }}
                                />
                            </div>
                            <div className="hp-text">
                                <span className="ap-label">AP</span> {c.ap.toFixed(1)}/{c.maxAp}
                            </div>
                            <div className="bar-bg">
                                <div className="bar-fill bar-ap" style={{ width: `${Math.min(100, apPct)}%` }} />
                            </div>
                            {/* 缠条 */}
                            <>
                                <div className="hp-text">
                                    <span className="chan-label">缠</span> {c.chan}/30
                                </div>
                                <div className="bar-bg">
                                    <div
                                        className="bar-fill bar-chan"
                                        style={{ width: `${Math.min(100, (c.chan / 30) * 100)}%` }}
                                    />
                                </div>
                            </>
                            <div className="buffs-grid">
                                {c.buffs.map((b) => {
                                    const def = getBuff(b.buffId)
                                    const label = b.stacks > 1 ? `${b.name}(${b.stacks})` : b.name
                                    return (
                                        <Tooltip key={b.buffId} content={def?.description ?? b.name}>
                                            <span className="buff-tag">{label}</span>
                                        </Tooltip>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

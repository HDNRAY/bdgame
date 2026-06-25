import { useNavigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { getNodeFlavorText } from '../../engine/systems/node-gen'
import { CharacterPanel } from '../components/CharacterPanel/CharacterPanel'
import { Character } from '../../engine/entities/character'
import { runBattle } from '../../engine/battle-runner'
import { getOpponentDef, gen } from '../../engine/data/opponents/index'
import { useGameRun } from '../hooks/useGameRun'
import type { CharacterBuild } from '../../engine/entities/character-build'
import './QuickRunScreen.scss'

export function QuickRunScreen() {
    const navigate = useNavigate()
    const { run, choices, lastResult, enterNode, select, selectReward } = useGameRun()
    const node = run.current.getCurrentNode()
    const flavor = getNodeFlavorText(node.index, run.current.state.build.story)

    // ── 修炼点水桶分配 ──
    // 在 useGameRun hook 的 enterNode/select 中自动处理

    // ── Header 按钮 ──
    const [view, setView] = useState<'play' | 'build' | 'spar'>('play')

    const renderMain = () => {
        if (view === 'build') {
            return (
                <div className="qr-build">
                    <CharacterPanel
                        mode="build"
                        build={run.current.state.build}
                        onSave={() => setView('play')}
                        onBack={() => setView('play')}
                    />
                </div>
            )
        }
        if (view === 'spar') {
            return (
                <div className="qr-spar">
                    <SparScreen playerBuild={run.current.state.build} onBack={() => setView('play')} />
                </div>
            )
        }

        switch (run.current.state.phase) {
            case 'idle': {
                if (choices.length > 0) {
                    if (node.type === 'boss') {
                        select(0)
                        return <div className="qr-loading">战斗中…</div>
                    }
                    return (
                        <div>
                            {flavor && <div className="qr-flavor">{flavor}</div>}
                            <div className="qr-choices">
                                {choices.map((c, i) => (
                                    <div key={c.id} className="qr-choice-card" onClick={() => select(i)}>
                                        <div className="qr-choice-name">{c.name}</div>
                                        {c.desc && <div className="qr-choice-desc">{c.desc}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }
                if (flavor) {
                    enterNode()
                }
                return <div className="qr-loading">加载中…</div>
            }

            case 'rewarding': {
                if (!lastResult) return <div className="qr-loading">加载中…</div>
                const r = lastResult
                return (
                    <div className="qr-result">
                        {r.battleResult && (
                            <div className="qr-battle-result">
                                <div className={r.battleResult === 'win' ? 'qr-win' : 'qr-lose'}>
                                    {r.battleResult === 'win' ? '✅ 胜利' : '❌ 败'}
                                </div>
                                {r.playerHp && (
                                    <div className="qr-battle-stats">
                                        玩家 HP: {r.playerHp.current}/{r.playerHp.max} | 对手 HP: {r.enemyHp?.current}/
                                        {r.enemyHp?.max} | 回合: ~{r.actionCount}
                                    </div>
                                )}
                            </div>
                        )}
                        {r.eventText && !r.battleResult && <div className="qr-event-text">{r.eventText}</div>}
                        {r.cultPoints && <div className="qr-cult">+{r.cultPoints} 修炼点</div>}
                        {r.rewardChoices && r.rewardChoices.length > 0 && (
                            <div className="qr-rewards">
                                <div className="qr-rewards-title">选奖励</div>
                                <div className="qr-rewards-list">
                                    {r.rewardChoices.map((rw) => (
                                        <div key={rw.id} className="qr-reward-card" onClick={() => selectReward(rw.id)}>
                                            <div className="qr-reward-name">{rw.name}</div>
                                            <div className="qr-reward-desc">{rw.description}</div>
                                            {rw.requireAttrsMin && (
                                                <div className="qr-reward-req">
                                                    需:{' '}
                                                    {Object.entries(rw.requireAttrsMin)
                                                        .map(([k, v]) => `${k}≥${v}`)
                                                        .join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            case 'event_choice':
                return <div className="qr-event-choice">事件分支选择（暂未实现）</div>

            case 'finished':
                return (
                    <div className="qr-finished">
                        <h2>🏆 通关</h2>
                        <p>伤势: {run.current.state.injury}/100</p>
                        <p>招式: {run.current.state.build.rewards.length} 个</p>
                        <p>击败: {run.current.defeatedEnemies.length} 人</p>
                        <button className="qr-btn" onClick={() => navigate('/')}>
                            返回主菜单
                        </button>
                    </div>
                )
        }
    }

    const ready = run.current.state.build.story && run.current.state.build.weapon

    return (
        <div className="qr">
            <div className="qr-header">
                <div className="qr-header-left">
                    <span className="qr-header-title">青山镇2088斗炁大会</span>
                    <span className="qr-header-info">
                        修炼点 {run.current.state.unspentCultPoints}
                        <span className="qr-injury-bar">
                            <span className="qr-injury-fill" style={{ width: `${run.current.state.injury}%` }} />
                            <span className="qr-injury-label">伤势 {run.current.state.injury}/100</span>
                        </span>
                    </span>
                </div>
                {ready && (
                    <div className="qr-header-right">
                        <button
                            className={'qr-header-btn' + (view === 'play' ? ' qr-header-btn-active' : '')}
                            onClick={() => setView('play')}
                        >
                            游戏
                        </button>
                        <button
                            className={'qr-header-btn' + (view === 'build' ? ' qr-header-btn-active' : '')}
                            onClick={() => setView(view === 'build' ? 'play' : 'build')}
                        >
                            备战
                        </button>
                        <button
                            className={'qr-header-btn' + (view === 'spar' ? ' qr-header-btn-active' : '')}
                            onClick={() => setView(view === 'spar' ? 'play' : 'spar')}
                        >
                            切磋
                        </button>
                    </div>
                )}
            </div>
            <div className="qr-body">
                {ready && (
                    <div className="qr-sidebar">
                        <CharacterPanel mode="view" build={run.current.state.build} />
                    </div>
                )}
                <div className="qr-content">{renderMain()}</div>
            </div>
        </div>
    )
}

/** 切磋面板 */
function SparScreen({ playerBuild, onBack }: { playerBuild: CharacterBuild; onBack: () => void }) {
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

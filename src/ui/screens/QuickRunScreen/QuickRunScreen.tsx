import { useNavigate } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import { getNodeFlavorText } from '../../../engine/systems/node-gen'
import { CharacterPanel } from '../../components/CharacterPanel/CharacterPanel'
import { GameRunHeader } from './GameRunHeader'
import { BossBattleView } from './BossBattleView'
import { SparScreen } from './SparScreen'
import { useGameRun } from '../../hooks/useGameRun'
import { cultCost } from '../../hooks/useBuildCharacter'
import { ALL_ATTRS } from '../../../engine/entities/attributes'
import type { CharacterBuild } from '../../../engine/entities/character-build'
import './QuickRunScreen.scss'

/** 计算指定 build 消耗的修炼点 */
function calcSpentCultPoints(build: CharacterBuild): number {
    const attrs = build.baseAttrs ?? {}
    let spent = 0
    for (const attr of ALL_ATTRS) {
        const v = attrs[attr as keyof typeof attrs] ?? 3
        for (let i = 3; i < v; i++) {
            spent += cultCost(i)
        }
    }
    return spent
}

export function QuickRunScreen() {
    const navigate = useNavigate()
    const {
        run,
        choices,
        lastResult,
        enterNode,
        select,
        selectReward,
        confirmContinue,
        updateBuild,
        selectEventChoice,
    } = useGameRun()
    const node = run.current.getCurrentNode()
    const flavor = getNodeFlavorText(node.index, run.current.state.build.story)

    // ── 修炼点水桶分配 ──
    // 在 useGameRun hook 的 enterNode/select 中自动处理

    // ── Header 按钮 ──
    const [view, setView] = useState<'play' | 'build' | 'spar'>('play')
    const [bossPhase, setBossPhase] = useState<'intro' | 'battle' | null>(null)
    const [showExitDialog, setShowExitDialog] = useState(false)

    const confirmExit = useCallback(() => {
        setShowExitDialog(false)
        navigate('/')
    }, [navigate])

    // 进入 idle 节点时自动加载选项（不依赖 flavor 是否存在）
    useEffect(() => {
        if (run.current.state.phase === 'idle' && choices.length === 0) {
            enterNode()
        }
    }, [choices.length, enterNode, run])

    const renderMain = () => {
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
                        return (
                            <BossBattleView
                                run={run}
                                phase={bossPhase}
                                onStart={() => setBossPhase('battle')}
                                onExit={() => {
                                    setBossPhase(null)
                                    select(0)
                                }}
                            />
                        )
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
                        {r.cultRewardSelected && (
                            <div className="qr-cult-confirm">
                                <div>已获得 +4 修炼点</div>
                                <button className="qr-btn" onClick={() => confirmContinue()}>
                                    继续
                                </button>
                            </div>
                        )}
                    </div>
                )
            }

            case 'interactive': {
                const step = run.current.getInteractiveStep()
                if (!step) {
                    return <div className="qr-loading">加载交互事件中…</div>
                }
                if (step.type === 'narrative') {
                    return (
                        <div className="qr-interactive-step">
                            <div className="narrative-text">{step.text}</div>
                            <button onClick={() => selectEventChoice(-1)}>继续</button>
                        </div>
                    )
                }
                if (step.type === 'choice') {
                    return (
                        <div className="qr-interactive-step">
                            <div className="choice-prompt">{step.prompt}</div>
                            <div className="choices-list">
                                {step.choices?.map((choice, idx) => (
                                    <button key={idx} onClick={() => selectEventChoice(idx)} className="choice-button">
                                        {choice.label}
                                        {choice.description && <div className="choice-desc">{choice.description}</div>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                }
                return <div className="qr-loading">处理交互事件中…</div>
            }

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

    const ready = run.current.state.build.story
    const isBossActive = bossPhase !== null

    if (isBossActive) {
        return <div className="qr-boss-full">{renderMain()}</div>
    }

    return (
        <div className="qr">
            <GameRunHeader
                run={run}
                view={view}
                setView={setView}
                showExitDialog={showExitDialog}
                setShowExitDialog={setShowExitDialog}
                onConfirmExit={confirmExit}
            />
            <div className="qr-body">
                {ready && (
                    <div className={'qr-sidebar' + (view === 'build' ? ' qr-sidebar--build' : '')}>
                        {view === 'build' ? (
                            (() => {
                                // 当进入 build 模式时，使用当前 unspentCultPoints 或已保存的 totalCultPoints 中的较大值
                                const buildForMode = {
                                    ...run.current.state.build,
                                    totalCultPoints: Math.max(
                                        run.current.state.unspentCultPoints,
                                        run.current.state.build.totalCultPoints ?? 0,
                                    ),
                                }
                                return (
                                    <CharacterPanel
                                        mode="build"
                                        build={buildForMode}
                                        unspentCultPoints={run.current.state.unspentCultPoints}
                                        onSave={(newBuild) => {
                                            const currentAvailable = run.current.state.unspentCultPoints
                                            const spent = calcSpentCultPoints(newBuild)
                                            const newUnspent = Math.max(0, currentAvailable - spent)
                                            // 保存总修炼点数，以便下次进入 build 模式时恢复
                                            newBuild.totalCultPoints = spent + newUnspent
                                            updateBuild(newBuild, newUnspent)
                                            setView('play')
                                        }}
                                        onBack={() => setView('play')}
                                    />
                                )
                            })()
                        ) : (
                            <CharacterPanel mode="view" build={run.current.state.build} />
                        )}
                    </div>
                )}
                <div className={'qr-content' + (ready ? ' qr-content--sidebar' : '')}>{renderMain()}</div>
            </div>
        </div>
    )
}

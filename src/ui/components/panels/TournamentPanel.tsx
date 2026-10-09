// ════════════════════════════════════════
//  TournamentPanel — 玩家侧「赛程」弹窗
//
//  在 RogueliteScreen 的 rs-header 点「赛程」打开，随时可看：
//  小组赛页签 = 8 组积分榜 + 每场比分；淘汰赛页签 = 16 强出线名单 + 十六强→决赛对阵。
//  默认页签跟着赛程阶段走（小组赛进行中 → 小组赛；出线结算后 → 淘汰赛），也可以手动切换。
//
//  纯展示：只读 gameState.tournamentData，不写任何状态、不影响赛程推进。
//
//  H5：整块铺满视口、高度上限 100%，正文自己纵向滚（.tnp-body 的 overflow-x: hidden
//  保证内部内容永远撑不开整页）；四列对阵表在窄屏由 TournamentBracket 竖排。
//  背景可点关闭，触屏高亮已在 .tnp-backdrop 关掉（-webkit-tap-highlight-color）。
// ════════════════════════════════════════

import { useEffect, useState } from 'react'
import type { TournamentData } from '../../../game/entities/tournament'
import { TournamentStandings } from '../tournament/TournamentStandings'
import { TournamentBracket } from '../tournament/TournamentBracket'
import '../tournament/tournament.scss'

interface TournamentPanelProps {
    tournament: TournamentData
    onClose: () => void
}

type View = 'group' | 'knockout'

export function TournamentPanel({ tournament, onClose }: TournamentPanelProps) {
    // 默认页签：还没出线就看小组赛，出线结算完（phase 已是 knockout / finished）直接看对阵
    const [view, setView] = useState<View>(tournament.phase === 'group_stage' ? 'group' : 'knockout')

    // Esc 关闭（渲染是同步的，键盘只是锦上添花）
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const nameOf = (id: string | null | undefined): string => {
        if (!id) return '未知'
        return tournament.participants.find((p) => p.id === id)?.name ?? id
    }
    const championId = tournament.knockoutStage.championId

    return (
        <div className="tnp" role="dialog" aria-modal="true" aria-label="斗炁大会赛程">
            {/* 整块背景：点一下关闭 */}
            <div className="tnp-backdrop" onClick={onClose} aria-hidden="true" />

            <div className="tnp-shell">
                <header className="tnp-head">
                    <h2 className="tnp-title">斗炁大会 赛程</h2>
                    <div className="tnp-tabs">
                        <button
                            className={`tnp-tab${view === 'group' ? ' active' : ''}`}
                            onClick={() => setView('group')}
                        >
                            小组赛
                        </button>
                        <button
                            className={`tnp-tab${view === 'knockout' ? ' active' : ''}`}
                            onClick={() => setView('knockout')}
                        >
                            淘汰赛
                        </button>
                    </div>
                    <button className="tnp-close" onClick={onClose}>
                        关闭
                    </button>
                </header>

                <div className="tnp-body">
                    {view === 'group' ? (
                        <TournamentStandings tournament={tournament} />
                    ) : (
                        <>
                            {championId && (
                                <div className="tnp-champion">
                                    冠军：<b>{nameOf(championId)}</b>
                                </div>
                            )}
                            {tournament.groupStage.qualifiers.length > 0 && (
                                <section>
                                    <h3 className="tnp-section-title">出线名单</h3>
                                    <ul className="tnp-qualifiers">
                                        {tournament.groupStage.qualifiers.map((id) => (
                                            <li
                                                key={id}
                                                className={`tnp-qualifier${id === tournament.playerId ? ' is-player' : ''}`}
                                            >
                                                {nameOf(id)}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            <section>
                                <h3 className="tnp-section-title">对阵表</h3>
                                <TournamentBracket tournament={tournament} />
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

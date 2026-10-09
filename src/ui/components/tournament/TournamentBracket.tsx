// ════════════════════════════════════════
//  TournamentBracket — 淘汰赛对阵表（只读展示）
//
//  十六强 → 八强 → 四强 → 决赛四列，每列列出该轮所有对局：
//  左名 / 比分 / 右名，胜者高亮；未定的位置显示「待定」。
//
//  本组件默认是**纯只读**的：对局行是普通元素、不可点。
//  DevMode 的大会模拟需要点进单局回放，额外传 onMatchClick 才会变成按钮；
//  activeRound 只用来给「正在进行的那一轮」加一圈高亮描边（不含 loading 文案）。
//
//  H5（硬要求）：四列在窄屏绝对放不下 —— 组件内部在 <=720px 时把四列**竖排**成
//  四段（每段一整行对局，名字/比分都看得清），而不是让整页横向溢出；
//  列宽用 minmax(0, 1fr) 且名字 ellipsis，任何宽度都不会顶开容器。
// ════════════════════════════════════════

import type { TournamentData } from '../../../game/entities/tournament'
import './tournament.scss'

interface TournamentBracketProps {
    tournament: TournamentData
    /** 正在进行的淘汰赛轮次（0-3）；只用于高亮，不传则不标 */
    activeRound?: number | null
    /** 对局行点击回调（matchKey = ko-<轮次>-<槽位>）；不传则整块只读 */
    onMatchClick?: (matchKey: string) => void
}

export function TournamentBracket({ tournament, activeRound = null, onMatchClick }: TournamentBracketProps) {
    const nameOf = (id: string | null | undefined): string => {
        if (!id) return '待定'
        return tournament.participants.find((p) => p.id === id)?.name ?? id
    }
    /** 玩家本人加下划线 */
    const playerCls = (id: string | null | undefined): string =>
        id && id === tournament.playerId ? ' tn-is-player' : ''

    return (
        <div className="tn-bracket">
            {tournament.knockoutStage.rounds.map((round) => (
                <div key={round.round} className="tn-round">
                    <h4>{round.label}</h4>
                    <div className="tn-ko-matches">
                        {round.matches.map((km) => {
                            const m = km.match
                            const finished = m !== null && m.winnerId !== null && m.winnerId !== undefined
                            const isCurrent = activeRound === km.round
                            const [aId, bId] = km.participantIds
                            const cls = [
                                'tn-ko-match',
                                finished ? 'tn-finished' : '',
                                isCurrent ? 'tn-current' : '',
                                onMatchClick && finished ? 'tn-match-btn' : '',
                            ]
                                .filter(Boolean)
                                .join(' ')
                            const row =
                                aId && bId ? (
                                    <>
                                        <b className={`tn-side${playerCls(aId)} ${m?.winnerId === aId ? 'tn-win' : ''}`}>
                                            {nameOf(aId)}
                                        </b>
                                        <span className="tn-score">
                                            {m ? `${m.scores[0]} : ${m.scores[1]}` : 'vs'}
                                        </span>
                                        <b
                                            className={`tn-side tn-side-b${playerCls(bId)} ${m?.winnerId === bId ? 'tn-win' : ''}`}
                                        >
                                            {nameOf(bId)}
                                        </b>
                                    </>
                                ) : (
                                    <span className="tn-tbd">待定</span>
                                )
                            const matchKey = `ko-${km.round}-${km.slotIndex}`
                            return onMatchClick ? (
                                <button
                                    key={km.slotIndex}
                                    className={cls}
                                    disabled={!finished}
                                    onClick={() => onMatchClick(matchKey)}
                                >
                                    {row}
                                </button>
                            ) : (
                                <div key={km.slotIndex} className={cls}>
                                    {row}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}

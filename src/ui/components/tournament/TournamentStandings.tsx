// ════════════════════════════════════════
//  TournamentStandings — 小组赛积分榜 + 每场比分（只读展示）
//
//  输入就是一个 TournamentData：积分榜按组渲染（出线前两名高亮），
//  组内每场比赛列在下方（名字 + 比分，胜者高亮）。
//
//  本组件默认是**纯只读**的：比赛行是普通元素、不可点。
//  DevMode 的大会模拟需要点进单局回放，额外传 onMatchClick 才会变成按钮；
//  activeRound 只用来给「正在进行的那一轮」加一圈高亮描边（不含 loading 文案）。
//
//  H5：组卡片网格用 minmax(min(240px, 100%), 1fr)，窄屏（320）也不会把页面撑宽；
//  名字统一 ellipsis 截断，不会顶开容器。
// ════════════════════════════════════════

import type { TournamentData } from '../../../game/entities/tournament'
import { getGroupRoundMatches } from '../../../game/tournament'
import './tournament.scss'

interface TournamentStandingsProps {
    tournament: TournamentData
    /** 正在进行的小组赛轮次（0-2）；只用于高亮，不传则不标 */
    activeRound?: number | null
    /** 比赛行点击回调（matchKey = group-<组名>-<下标>）；不传则整块只读 */
    onMatchClick?: (matchKey: string) => void
}

export function TournamentStandings({ tournament, activeRound = null, onMatchClick }: TournamentStandingsProps) {
    const nameOf = (id: string | null | undefined): string => {
        if (!id) return '待定'
        return tournament.participants.find((p) => p.id === id)?.name ?? id
    }
    /** 玩家本人加下划线（双方 id 相同是不可能的，放心按 id 比） */
    const playerCls = (id: string | null | undefined): string =>
        id && id === tournament.playerId ? ' tn-is-player' : ''

    return (
        <div className="tn-groups">
            {tournament.groupStage.groups.map((group, gi) => {
                const standings = tournament.groupStage.standings[gi] ?? []
                const currentMatches =
                    activeRound === null ? [] : getGroupRoundMatches(group, activeRound)
                return (
                    <div key={group.name} className="tn-group">
                        <h4>{group.name} 组</h4>
                        <ol className="tn-standings">
                            {standings.map((entry, rank) => (
                                <li key={entry.participantId} className={rank < 2 ? 'tn-qualify' : ''}>
                                    <span className="tn-rank">{rank + 1}</span>
                                    <span className={`tn-name${playerCls(entry.participantId)}`}>
                                        {nameOf(entry.participantId)}
                                    </span>
                                    <span className="tn-rec">
                                        {entry.wins}胜{entry.losses}负
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <div className="tn-matches">
                            {group.matches.map((m, i) => {
                                const finished = m.winnerId !== null && m.winnerId !== undefined
                                const isCurrent = currentMatches.includes(i)
                                const cls = [
                                    'tn-match',
                                    finished ? 'tn-finished' : '',
                                    isCurrent ? 'tn-current' : '',
                                    onMatchClick && finished ? 'tn-match-btn' : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ')
                                const row = (
                                    <>
                                        <b
                                            className={`tn-side${playerCls(m.participantIds[0])} ${m.winnerId === m.participantIds[0] ? 'tn-win' : ''}`}
                                        >
                                            {nameOf(m.participantIds[0])}
                                        </b>
                                        <span className="tn-score">
                                            {finished ? `${m.scores[0]} : ${m.scores[1]}` : 'vs'}
                                        </span>
                                        <b
                                            className={`tn-side tn-side-b${playerCls(m.participantIds[1])} ${m.winnerId === m.participantIds[1] ? 'tn-win' : ''}`}
                                        >
                                            {nameOf(m.participantIds[1])}
                                        </b>
                                    </>
                                )
                                const matchKey = `group-${group.name}-${i}`
                                return onMatchClick ? (
                                    <button
                                        key={i}
                                        className={cls}
                                        disabled={!finished}
                                        onClick={() => onMatchClick(matchKey)}
                                    >
                                        {row}
                                    </button>
                                ) : (
                                    <div key={i} className={cls}>
                                        {row}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

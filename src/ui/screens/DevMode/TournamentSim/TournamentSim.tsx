// ════════════════════════════════════════
//  TournamentSim — 一键模拟整个斗炁大会（DevMode）
//  最大化复用现有 tournament 系统：
//    - selectParticipants / buildEmptyTournament（种子蛇形分组，32 人 n33）
//    - simulateGroupRound（小组赛 BO1）/ simulateKnockoutRound（淘汰赛 BO3）
//  仅开启 captureLogs 让每局保留回放 log，可嵌入 BattlePanel 逐局回看。
//  逐轮异步驱动：每轮前 await tick() 让 React 先刷新「进行中…」loading 帧，
//  再做同步战斗计算（真实战斗本身有耗时，无需人为延迟）。
// ════════════════════════════════════════

import { useMemo, useState } from 'react'
import type { TournamentData, MatchResult, TournamentParticipant } from '../../../../game/entities/tournament'
import { GROUP_MAX_ROUNDS, KNOCKOUT_ROUNDS, ROUND_LABELS } from '../../../../game/entities/tournament'
import {
    buildEmptyTournament,
    getGroupRoundMatches,
    selectParticipants,
    simulateGroupRound,
    simulateKnockoutRound,
} from '../../../../game/tournament'
import { gen, getOpponentDef } from '../../../../data/opponents'
import { formatBattleLog } from '../../../../engine/format-log'
import { BattleLog } from '../../../../engine/combat/battle-log'
import type { LogEntry } from '../../../../bridge/replay-engine'
import type { CharacterBuild } from '../../../../game/entities/character-build'
import { BattlePanel, type BattleData } from '../../../components/BattlePanel/BattlePanel'
import './TournamentSim.scss'

type SimStatus = 'idle' | 'running' | 'done'

interface RoundCursor {
    kind: 'group' | 'knockout'
    round: number
}

interface ReplaySelection {
    matchKey: string
    gameIndex: number
}

/** 让 React 先刷新 loading 帧，再做同步战斗计算 */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** 从存储的 log 条目重建 BattleLog（formatBattleLog 只依赖 getAll） */
function entriesToBattleLog(entries: LogEntry[]): BattleLog {
    const log = new BattleLog()
    for (const e of entries) log.push(e.event, e.timelineMs)
    return log
}

/** 在 TournamentData 中按 key 定位一场比赛（group-<组名>-<下标> / ko-<轮>-<槽位>） */
function findMatch(t: TournamentData, key: string): MatchResult | null {
    if (key.startsWith('group-')) {
        const parts = key.split('-')
        const group = t.groupStage.groups.find((g) => g.name === parts[1])
        return group?.matches[Number(parts[2])] ?? null
    }
    if (key.startsWith('ko-')) {
        const parts = key.split('-')
        const km = t.knockoutStage.rounds[Number(parts[1])]?.matches[Number(parts[2])]
        return km?.match ?? null
    }
    return null
}

/** 从单局回放重建 BattleData（供 BattlePanel initialData 直接回放） */
function buildBattleData(
    match: MatchResult,
    gameIndex: number,
    participants: TournamentParticipant[],
): BattleData | null {
    const game = match.games?.[gameIndex]
    if (!game?.logEntries || game.logEntries.length === 0) return null
    const entries = game.logEntries as LogEntry[]
    const snapshots = entries.map((e) => e.event.snapshot)
    const { lines, eventToLine } = formatBattleLog(entriesToBattleLog(entries))
    const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? id
    const [aId, bId] = match.participantIds
    return {
        entries,
        logLines: lines,
        eventToLine,
        snapshots,
        charAInfo: { id: aId, name: nameOf(aId), color: '#4ecdc4' },
        charBInfo: { id: bId, name: nameOf(bId), color: '#ff6b6b' },
    }
}

export function TournamentSim() {
    const [tournament, setTournament] = useState<TournamentData | null>(null)
    const [status, setStatus] = useState<SimStatus>('idle')
    const [cursor, setCursor] = useState<RoundCursor | null>(null)
    const [selected, setSelected] = useState<ReplaySelection | null>(null)

    const nameOf = (id: string | null | undefined): string => {
        if (!id || !tournament) return '待定'
        return tournament.participants.find((p) => p.id === id)?.name ?? id
    }

    const phaseLabel = (c: RoundCursor): string =>
        c.kind === 'group' ? `小组赛 第${c.round + 1}轮` : (ROUND_LABELS[c.round] ?? `淘汰赛 第${c.round + 1}轮`)

    const handleSimulate = async () => {
        if (status === 'running') return
        setStatus('running')
        setSelected(null)
        const players = selectParticipants({ includePlayer: false })
        const { groupStage, knockoutStage } = buildEmptyTournament(players, null)
        let cur: TournamentData = {
            name: '斗炁大会',
            phase: 'group_stage',
            playerId: null,
            participants: players,
            groupStage,
            knockoutStage,
        }
        setTournament(cur)
        try {
            // 小组赛：BO1，3 轮
            for (let r = 0; r < GROUP_MAX_ROUNDS; r++) {
                setCursor({ kind: 'group', round: r })
                await tick()
                cur = simulateGroupRound(cur, { captureLogs: true })
                setTournament(cur)
            }
            // 淘汰赛：BO3，十六强→八强→四强→决赛
            for (let r = 0; r < KNOCKOUT_ROUNDS; r++) {
                setCursor({ kind: 'knockout', round: r })
                await tick()
                cur = simulateKnockoutRound(cur, { captureLogs: true })
                setTournament(cur)
            }
        } catch (err) {
            console.error('大会模拟失败', err)
        } finally {
            setCursor(null)
            setStatus('done')
        }
    }

    const championId = tournament?.knockoutStage.championId ?? null

    const openReplay = (matchKey: string) => setSelected({ matchKey, gameIndex: 0 })

    // ── 回放数据 ──
    const replayMatch = useMemo(
        () => (tournament && selected ? findMatch(tournament, selected.matchKey) : null),
        [tournament, selected],
    )
    const replayData = useMemo(
        () =>
            replayMatch && selected && tournament
                ? buildBattleData(replayMatch, selected.gameIndex, tournament.participants)
                : null,
        [replayMatch, selected, tournament],
    )
    const replayBuilds = useMemo<[CharacterBuild, CharacterBuild] | null>(() => {
        if (!replayMatch || !tournament) return null
        const levelOf = (id: string) => tournament.participants.find((p) => p.id === id)?.level ?? 33
        const defA = getOpponentDef(replayMatch.participantIds[0])
        const defB = getOpponentDef(replayMatch.participantIds[1])
        if (!defA || !defB) return null
        return [gen(defA, levelOf(replayMatch.participantIds[0])), gen(defB, levelOf(replayMatch.participantIds[1]))]
    }, [replayMatch, tournament])

    return (
        <div className="tsim">
            <header className="tsim-header">
                <h2>大会模拟</h2>
                <button className="tsim-run" onClick={handleSimulate} disabled={status === 'running'}>
                    {status === 'running' ? '模拟中…' : status === 'done' ? '重新模拟' : '一键模拟'}
                </button>
                {status === 'running' && cursor && (
                    <span className="tsim-loading">
                        <span className="tsim-spinner" aria-hidden />
                        正在模拟：{phaseLabel(cursor)}…
                    </span>
                )}
            </header>

            {tournament && (
                <>
                    {status === 'done' && championId && (
                        <div className="tsim-champion">
                            🏆 冠军：<b>{nameOf(championId)}</b>
                        </div>
                    )}

                    <section className="tsim-section">
                        <h3>小组赛</h3>
                        <div className="tsim-groups">
                            {tournament.groupStage.groups.map((group, gi) => {
                                const standings = tournament.groupStage.standings[gi] ?? []
                                return (
                                    <div key={group.name} className="tsim-group">
                                        <h4>{group.name} 组</h4>
                                        <ol className="tsim-standings">
                                            {standings.map((entry, rank) => (
                                                <li
                                                    key={entry.participantId}
                                                    className={rank < 2 ? 'tsim-qualify' : ''}
                                                >
                                                    <span className="tsim-rank">{rank + 1}</span>
                                                    <span className="tsim-name">{nameOf(entry.participantId)}</span>
                                                    <span className="tsim-rec">
                                                        {entry.wins}胜{entry.losses}负
                                                    </span>
                                                </li>
                                            ))}
                                        </ol>
                                        <div className="tsim-matches">
                                            {group.matches.map((m, i) => {
                                                const finished = m.winnerId !== null && m.winnerId !== undefined
                                                const isCurrent =
                                                    status === 'running' &&
                                                    cursor !== null &&
                                                    cursor.kind === 'group' &&
                                                    getGroupRoundMatches(group, cursor.round).includes(i)
                                                const cls = [
                                                    'tsim-match',
                                                    finished ? 'tsim-finished' : '',
                                                    isCurrent ? 'tsim-current' : '',
                                                ].join(' ')
                                                return (
                                                    <button
                                                        key={i}
                                                        className={cls}
                                                        disabled={!finished}
                                                        onClick={() => openReplay(`group-${group.name}-${i}`)}
                                                    >
                                                        {isCurrent ? (
                                                            <span className="tsim-inline-loading">
                                                                <span className="tsim-spinner" aria-hidden />
                                                                进行中…
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                <b
                                                                    className={
                                                                        m.winnerId === m.participantIds[0]
                                                                            ? 'tsim-win'
                                                                            : ''
                                                                    }
                                                                >
                                                                    {nameOf(m.participantIds[0])}
                                                                </b>
                                                                <span className="tsim-vs">
                                                                    {finished
                                                                        ? `${m.scores[0]} : ${m.scores[1]}`
                                                                        : 'vs'}
                                                                </span>
                                                                <b
                                                                    className={
                                                                        m.winnerId === m.participantIds[1]
                                                                            ? 'tsim-win'
                                                                            : ''
                                                                    }
                                                                >
                                                                    {nameOf(m.participantIds[1])}
                                                                </b>
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    <section className="tsim-section">
                        <h3>淘汰赛</h3>
                        <div className="tsim-bracket">
                            {tournament.knockoutStage.rounds.map((round) => (
                                <div key={round.round} className="tsim-round">
                                    <h4>{round.label}</h4>
                                    <div className="tsim-ko-matches">
                                        {round.matches.map((km) => {
                                            const m = km.match
                                            const finished =
                                                m !== null && m.winnerId !== null && m.winnerId !== undefined
                                            const isCurrent =
                                                status === 'running' &&
                                                cursor !== null &&
                                                cursor.kind === 'knockout' &&
                                                cursor.round === km.round
                                            const [aId, bId] = km.participantIds
                                            const cls = [
                                                'tsim-ko-match',
                                                finished ? 'tsim-finished' : '',
                                                isCurrent ? 'tsim-current' : '',
                                            ].join(' ')
                                            return (
                                                <button
                                                    key={km.slotIndex}
                                                    className={cls}
                                                    disabled={!finished}
                                                    onClick={() => openReplay(`ko-${km.round}-${km.slotIndex}`)}
                                                >
                                                    {isCurrent ? (
                                                        <span className="tsim-inline-loading">
                                                            <span className="tsim-spinner" aria-hidden />
                                                            进行中…
                                                        </span>
                                                    ) : aId && bId ? (
                                                        <span>
                                                            <b className={m?.winnerId === aId ? 'tsim-win' : ''}>
                                                                {nameOf(aId)}
                                                            </b>
                                                            <span className="tsim-vs">
                                                                {m ? `${m.scores[0]} : ${m.scores[1]}` : 'vs'}
                                                            </span>
                                                            <b className={m?.winnerId === bId ? 'tsim-win' : ''}>
                                                                {nameOf(bId)}
                                                            </b>
                                                        </span>
                                                    ) : (
                                                        <span className="tsim-tbd">待定</span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}

            {selected && replayMatch && (
                <section className="tsim-replay">
                    <div className="tsim-replay-head">
                        <h3>
                            回放：{nameOf(replayMatch.participantIds[0])} vs {nameOf(replayMatch.participantIds[1])}
                        </h3>
                        {replayMatch.games && replayMatch.games.length > 1 && (
                            <div className="tsim-game-tabs">
                                {replayMatch.games.map((_, i) => (
                                    <button
                                        key={i}
                                        className={selected.gameIndex === i ? 'active' : ''}
                                        onClick={() => setSelected({ matchKey: selected.matchKey, gameIndex: i })}
                                    >
                                        第{i + 1}局
                                    </button>
                                ))}
                            </div>
                        )}
                        <button className="tsim-close" onClick={() => setSelected(null)}>
                            关闭
                        </button>
                    </div>
                    {replayData && replayBuilds ? (
                        <BattlePanel
                            key={`${selected.matchKey}-${selected.gameIndex}`}
                            buildA={replayBuilds[0]}
                            buildB={replayBuilds[1]}
                            showSidePanels={false}
                            initialData={replayData}
                        />
                    ) : (
                        <p className="tsim-no-replay">该局暂无回放数据</p>
                    )}
                </section>
            )}
        </div>
    )
}

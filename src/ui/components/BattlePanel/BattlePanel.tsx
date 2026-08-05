import { useState, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { CharacterBuild } from '../../../game/entities/character-build'
import { Character } from '../../../engine/entities/character'
import { runBattle } from '../../../engine/battle-runner'
import { formatBattleLog } from '../../../engine/format-log'
import type { LogEntry } from '../../../bridge/replay-engine'
import { CharacterPanel } from '../CharacterPanel/CharacterPanel'
import { AnimationPanel, type AnimationPanelHandle } from '../AnimationPanel/AnimationPanel'
import { ControlsBar } from '../ControlsBar/ControlsBar'
import { BattleStatusPanel } from '../BattleStatusPanel/BattleStatusPanel'
import { LogPanel } from '../LogPanel/LogPanel'
import type { BattleSnapshot } from '../../../engine/combat/types'
import './BattlePanel.scss'

export interface BattlePanelProps {
    buildA: CharacterBuild
    buildB: CharacterBuild
    showSidePanels?: boolean
    onBattleEnd?: () => void
    /** 预计算的回放数据；提供时直接回放该场，不再重新战斗 */
    initialData?: BattleData
}

export interface BattlePanelHandle {
    togglePlay: () => void
    setSpeed: (s: number) => void
    seek: (pct: number) => void
    replay: () => void
    getState: () => { playing: boolean; speed: number; progress: number; currentTime: number }
}

export interface BattleData {
    entries: LogEntry[]
    logLines: string[]
    eventToLine: number[]
    snapshots: BattleSnapshot[]
    charAInfo: { id: string; name: string; color: string }
    charBInfo: { id: string; name: string; color: string }
}

export const BattlePanel = forwardRef<BattlePanelHandle, BattlePanelProps>(function BattlePanel(
    { buildA, buildB, showSidePanels = true, onBattleEnd, initialData },
    ref,
) {
    const [battleKey] = useState(0)
    const battleEndedRef = useRef(false)

    // 战斗数据：在 render 阶段计算（同步），通过 battleKey 触发重打
    const battleData: BattleData = useMemo(() => {
        if (initialData) return initialData
        const a = new Character(buildA)
        const b = new Character(buildB)
        const { engine } = runBattle(a, b, undefined, 6)
        const snapshots = engine.state.log.getAll().map((e) => e.event.snapshot)
        const { lines: log, eventToLine } = formatBattleLog(engine.state.log)
        return {
            entries: engine.state.log.getAll() as LogEntry[],
            logLines: log,
            eventToLine,
            snapshots,
            charAInfo: {
                id: engine.state.characters[0].id,
                name: engine.state.characters[0].name,
                color: '#4ecdc4' as const,
            },
            charBInfo: {
                id: engine.state.characters[1].id,
                name: engine.state.characters[1].name,
                color: '#ff6b6b' as const,
            },
        }
    }, [buildA, buildB, initialData])

    const { entries, logLines, eventToLine, snapshots, charAInfo, charBInfo } = battleData

    // 按时间排序 events + 每行 log 对应的 battle time
    const sortedEntries = useMemo(() => entries.slice().sort((a, b) => a.timelineMs - b.timelineMs), [entries])
    const lineTimelineMs = useMemo(() => {
        const times: number[] = new Array(logLines.length)
        let ei = 0
        const lastMs = sortedEntries[sortedEntries.length - 1]?.timelineMs ?? 0
        for (let li = 0; li < logLines.length; li++) {
            while (ei < eventToLine.length && li > eventToLine[ei]) ei++
            times[li] = ei < sortedEntries.length ? sortedEntries[ei].timelineMs : lastMs
        }
        return times
    }, [logLines.length, eventToLine, sortedEntries])

    const [currentSnapshot, setCurrentSnapshot] = useState<BattleSnapshot | null>(() => snapshots[0] ?? null)
    const [currentLine, setCurrentLine] = useState(0)
    const [playState, setPlayState] = useState({ playing: false, speed: 1, progress: 0, currentTime: 0 })

    const animRef = useRef<AnimationPanelHandle>(null)

    // 帧回调
    const handleFrame = useCallback(
        (logIndex: number, state: { playing: boolean; speed: number; progress: number; currentTime: number }) => {
            setPlayState(state)
            setCurrentLine(eventToLine[logIndex] ?? logIndex)
            const snap = snapshots[logIndex] ?? null
            if (snap) setCurrentSnapshot(snap)

            if (state.progress >= 1 && !battleEndedRef.current) {
                battleEndedRef.current = true
                onBattleEnd?.()
            }
        },
        [snapshots, eventToLine, onBattleEnd],
    )

    const handleTogglePlay = useCallback(() => animRef.current?.togglePlay(), [])
    const handleChangeSpeed = useCallback((s: number) => animRef.current?.setSpeed(s), [])
    const handleSeekEvent = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        animRef.current?.seek((e.clientX - rect.left) / rect.width)
    }, [])
    const handleSeekPct = useCallback((pct: number) => animRef.current?.seek(pct), [])
    const handleReplay = useCallback(() => {
        battleEndedRef.current = false
        setCurrentLine(0)
        setPlayState({ playing: true, speed: 1, progress: 0, currentTime: 0 })
        animRef.current?.replay()
    }, [])

    // 暴露播放控制给父组件（用于窄屏抽屉自动暂停/恢复等）
    useImperativeHandle(
        ref,
        () => ({
            togglePlay: handleTogglePlay,
            setSpeed: handleChangeSpeed,
            seek: handleSeekPct,
            replay: handleReplay,
            getState: () => playState,
        }),
        [handleTogglePlay, handleChangeSpeed, handleSeekPct, handleReplay, playState],
    )

    return (
        <div className="battle-panel-root">
            {showSidePanels && (
                <div className="bp-side">
                    <CharacterPanel mode="view" build={buildA} accentColor={charAInfo.color} />
                </div>
            )}
            <div className="bp-center">
                <AnimationPanel
                    ref={animRef}
                    key={battleKey}
                    entries={entries}
                    charA={charAInfo}
                    charB={charBInfo}
                    onFrame={handleFrame}
                />
                <ControlsBar
                    playing={playState.playing}
                    speed={playState.speed}
                    progress={playState.progress}
                    currentTime={playState.currentTime}
                    onTogglePlay={handleTogglePlay}
                    onChangeSpeed={handleChangeSpeed}
                    onSeek={handleSeekEvent}
                    onReplay={handleReplay}
                />
                {currentSnapshot && (
                    <BattleStatusPanel
                        snapshot={currentSnapshot}
                        charAName={charAInfo.name}
                        charBName={charBInfo.name}
                    />
                )}
                <LogPanel
                    logLines={logLines}
                    currentLine={currentLine}
                    lineTimelineMs={lineTimelineMs}
                    speed={playState.speed}
                />
            </div>
            {showSidePanels && (
                <div className="bp-side">
                    <CharacterPanel mode="view" build={buildB} accentColor={charBInfo.color} />
                </div>
            )}
        </div>
    )
})

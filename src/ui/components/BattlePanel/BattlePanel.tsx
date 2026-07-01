import { useState, useRef, useMemo, useCallback } from 'react'
import type { CharacterBuild } from '../../../engine/entities/character-build'
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

interface BattlePanelProps {
    buildA: CharacterBuild
    buildB: CharacterBuild
    showSidePanels?: boolean
    onBattleEnd?: () => void
}

interface BattleData {
    entries: LogEntry[]
    logLines: string[]
    eventToLine: number[]
    snapshots: BattleSnapshot[]
    charAInfo: { id: string; name: string; color: string }
    charBInfo: { id: string; name: string; color: string }
}

export function BattlePanel({ buildA, buildB, showSidePanels = true, onBattleEnd }: BattlePanelProps) {
    const [battleKey] = useState(0)
    const battleEndedRef = useRef(false)

    // 战斗数据：在 render 阶段计算（同步），通过 battleKey 触发重打
    const battleData: BattleData = useMemo(() => {
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
    }, [buildA, buildB])

    const { entries, logLines, eventToLine, snapshots, charAInfo, charBInfo } = battleData

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
    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        animRef.current?.seek((e.clientX - rect.left) / rect.width)
    }, [])
    const handleReplay = useCallback(() => animRef.current?.replay(), [])

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
                    onSeek={handleSeek}
                    onReplay={handleReplay}
                />
                {currentSnapshot && (
                    <BattleStatusPanel
                        snapshot={currentSnapshot}
                        charAName={charAInfo.name}
                        charBName={charBInfo.name}
                    />
                )}
                <LogPanel logLines={logLines} currentLine={currentLine} />
            </div>
            {showSidePanels && (
                <div className="bp-side">
                    <CharacterPanel mode="view" build={buildB} accentColor={charBInfo.color} />
                </div>
            )}
        </div>
    )
}

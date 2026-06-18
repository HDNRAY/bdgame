import { useEffect, useRef, useState, useCallback } from 'react'
import { ReplayEngine, type LogEntry } from '../../../replay/replay-engine'
import type { BattleSnapshot } from '../../../engine/combat/types'
import { CanvasRenderer } from '../../canvas/renderer'
import './ReplayPanel.scss'

interface ReplayPanelProps {
    entries: LogEntry[]
    charA: { id: string; name: string; color: string }
    charB: { id: string; name: string; color: string }
    logLines: string[]
    eventToLine: number[]
    snapshots?: BattleSnapshot[]
    onFrame?: (snapshot: BattleSnapshot, logIndex: number) => void
    onRefight?: () => void
    onBack?: () => void
    compact?: boolean
}

export function ReplayPanel({
    entries,
    charA,
    charB,
    logLines,
    eventToLine,
    snapshots,
    onFrame,
    onRefight,
    onBack,
    compact,
}: ReplayPanelProps) {
    const canvasRef = useRef<HTMLDivElement>(null)
    const engineRef = useRef<ReplayEngine | null>(null)
    const rendererRef = useRef<CanvasRenderer | null>(null)
    const logEndRef = useRef<HTMLDivElement>(null)
    const logRef = useRef<HTMLDivElement>(null)

    const [playing, setPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)
    const [progress, setProgress] = useState(0)
    const [currentLine, setCurrentLine] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const [autoScroll, setAutoScroll] = useState(true)
    const [logFontSize, setLogFontSize] = useState(13)
    const lastLogTime = useRef(0)
    const logTargetRef = useRef(0)
    const LOG_INTERVAL = 300 // ms

    useEffect(() => {
        const el = canvasRef.current
        if (!el || entries.length === 0) return

        const replay = new ReplayEngine(entries)
        engineRef.current = replay

        const renderer = new CanvasRenderer()
        rendererRef.current = renderer
        renderer.init(el).then(() => {
            renderer.registerChar(charA.id, charA.name, charA.color)
            renderer.registerChar(charB.id, charB.name, charB.color)

            const f = replay.getFrameAt(0)
            renderer.render(f)
            renderer.setEntries(entries as never[])

            replay.onFrameCallback((f) => {
                renderer.render(f)
                setProgress(f.total > 0 ? f.time / f.total : 0)
                // log 行逐行出现，每行间隔 LOG_INTERVAL
                const targetLine = eventToLine?.[f.eventIndex] ?? Math.min(f.eventIndex, logLines.length - 1)
                logTargetRef.current = targetLine
                if (performance.now() - lastLogTime.current >= LOG_INTERVAL) {
                    setCurrentLine((prev) => {
                        const next = Math.min(prev + 1, logTargetRef.current)
                        if (next > prev) lastLogTime.current = performance.now()
                        return next
                    })
                }
                setCurrentTime(f.time)
                if (f.time >= f.total) setPlaying(false)
                // 上报当前帧快照
                const snap = snapshots?.[f.eventIndex]
                if (snap) onFrame?.(snap, targetLine)
            })
        })

        return () => {
            engineRef.current?.destroy()
            rendererRef.current?.destroy()
            engineRef.current = null
            rendererRef.current = null
        }
    }, [charA, charB, entries, logLines.length, eventToLine, snapshots, onFrame])

    useEffect(() => {
        engineRef.current?.setSpeed(speed)
    }, [speed])

    useEffect(() => {
        if (playing && autoScroll) {
            const el = logRef.current
            if (el) el.scrollTop = el.scrollHeight
        }
    }, [currentLine, playing, autoScroll])

    // 检测用户手动滚动 → 暂停自动滚动；滚回底部 → 恢复
    const handleLogScroll = useCallback(() => {
        const el = logRef.current
        if (!el) return
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
        setAutoScroll(nearBottom)
    }, [])

    const togglePlay = useCallback(() => {
        const replay = engineRef.current
        if (!replay) return
        if (replay.isPlaying) {
            replay.pause()
            setPlaying(false)
        } else {
            // 播完了再次点击 → 重播
            if (replay.time >= replay.totalDuration) {
                replay.seek(0)
            }
            replay.play(speed)
            setPlaying(true)
        }
    }, [speed])

    const changeSpeed = useCallback((s: number) => {
        setSpeed(s)
        engineRef.current?.setSpeed(s)
    }, [])

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const replay = engineRef.current
        if (!replay) return
        const rect = e.currentTarget.getBoundingClientRect()
        const pct = (e.clientX - rect.left) / rect.width
        replay.seek(pct * replay.totalDuration)
        setProgress(pct)
    }, [])

    const handleReplay = useCallback(() => {
        onRefight?.()
    }, [onRefight])

    const handleRefight = useCallback(() => {
        onRefight?.()
    }, [onRefight])

    const handleBack = useCallback(() => {
        onBack?.()
    }, [onBack])

    return (
        <div className="replay-panel">
            <div ref={canvasRef} className={`canvas-wrap ${compact ? 'compact' : ''}`} />

            <div className="controls">
                <button className="ctrl-btn" onClick={togglePlay}>
                    {playing ? '⏸' : '▶'}
                </button>
                {[0.5, 1, 2, 4].map((s) => (
                    <button
                        key={s}
                        className={`ctrl-btn ${speed === s ? 'active' : ''}`}
                        onClick={() => changeSpeed(s)}
                    >
                        {s}×
                    </button>
                ))}
                <div className="progress" onClick={handleSeek}>
                    <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
                </div>
                <span className="timestamp">{(currentTime / 1000).toFixed(1)}s</span>

                <button className="ctrl-btn replay-btn" onClick={handleReplay} title="重播">
                    ↺
                </button>
                <button className="ctrl-btn refight-btn" onClick={handleRefight} title="重打">
                    ⚔
                </button>
                <button className="ctrl-btn back-btn" onClick={handleBack} title="返回选人">
                    ←
                </button>
                <span className="font-size-ctrl">
                    <button
                        className="ctrl-btn"
                        onClick={() => setLogFontSize((s) => Math.max(9, s - 1))}
                        title="缩小日志"
                    >
                        A−
                    </button>
                    <button
                        className="ctrl-btn"
                        onClick={() => setLogFontSize((s) => Math.min(24, s + 1))}
                        title="放大日志"
                    >
                        A+
                    </button>
                </span>
            </div>

            {!compact && (
                <div ref={logRef} className="log" style={{ fontSize: logFontSize }} onScroll={handleLogScroll}>
                    {logLines.slice(0, currentLine + 1).map((line, i) => (
                        <div key={i} className={`log-line ${i === currentLine ? 'current' : 'past'}`}>
                            {line}
                        </div>
                    ))}
                    <div ref={logEndRef} />
                </div>
            )}
        </div>
    )
}

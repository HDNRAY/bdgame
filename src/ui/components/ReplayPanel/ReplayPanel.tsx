import { useEffect, useRef, useState, useCallback } from 'react'
import { ReplayEngine, type LogEntry } from '../../../replay/replay-engine'
import { CanvasRenderer } from '../../canvas-renderer'
import './ReplayPanel.scss'

interface ReplayPanelProps {
    entries: LogEntry[]
    charA: { id: string; name: string; color: string }
    charB: { id: string; name: string; color: string }
    logLines: string[]
    compact?: boolean
}

export function ReplayPanel({ entries, charA, charB, logLines, compact }: ReplayPanelProps) {
    const canvasRef = useRef<HTMLDivElement>(null)
    const engineRef = useRef<ReplayEngine | null>(null)
    const rendererRef = useRef<CanvasRenderer | null>(null)
    const logEndRef = useRef<HTMLDivElement>(null)

    const [playing, setPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)
    const [progress, setProgress] = useState(0)
    const [currentLine, setCurrentLine] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)

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

            replay.onFrameCallback((f) => {
                renderer.render(f)
                setProgress(f.total > 0 ? f.time / f.total : 0)
                setCurrentLine(Math.min(f.eventIndex, logLines.length - 1))
                setCurrentTime(f.time)
            })
        })

        return () => {
            engineRef.current?.destroy()
            rendererRef.current?.destroy()
            engineRef.current = null
            rendererRef.current = null
        }
    }, [charA, charB, entries, logLines.length])

    useEffect(() => {
        engineRef.current?.setSpeed(speed)
    }, [speed])

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [currentLine])

    const togglePlay = useCallback(() => {
        const replay = engineRef.current
        if (!replay) return
        if (replay.isPlaying) {
            replay.pause()
            setPlaying(false)
        } else {
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
            </div>

            {!compact && (
                <div className="log">
                    {logLines.map((line, i) => (
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

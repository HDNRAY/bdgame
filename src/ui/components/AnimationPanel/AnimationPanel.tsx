import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { ReplayEngine, type LogEntry, type FrameChar } from '../../../bridge/replay-engine'
import { CanvasRenderer } from '../../canvas/renderer'
import { useAppStore, getEffectiveTheme } from '../../stores/app-store'
import './AnimationPanel.scss'

export interface AnimationPanelHandle {
    togglePlay: () => void
    setSpeed: (s: number) => void
    seek: (pct: number) => void
    getState: () => { playing: boolean; speed: number; progress: number; currentTime: number; turn: number }
    replay: () => void
}

interface AnimationPanelProps {
    entries: LogEntry[]
    charA: { id: string; name: string; color: string }
    charB: { id: string; name: string; color: string }
    onFrame?: (
        logIndex: number,
        playState: { playing: boolean; speed: number; progress: number; currentTime: number; turn: number },
        chars?: FrameChar[],
    ) => void
    compact?: boolean
}

export const AnimationPanel = forwardRef<AnimationPanelHandle, AnimationPanelProps>(function AnimationPanel(
    { entries, charA, charB, onFrame, compact },
    ref,
) {
    const canvasRef = useRef<HTMLDivElement>(null)
    const engineRef = useRef<ReplayEngine | null>(null)
    const rendererRef = useRef<CanvasRenderer | null>(null)
    const speedRef = useRef(1)

    const [playing, setPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)
    const [progress, setProgress] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)

    // 主题：影响角色描边色
    const theme = useAppStore((s) => s.uiConfig.theme)
    const effectiveTheme: 'light' | 'dark' = getEffectiveTheme(theme)

    useEffect(() => {
        rendererRef.current?.setTheme(effectiveTheme)
    }, [effectiveTheme])

    useEffect(() => {
        const el = canvasRef.current
        if (!el || entries.length === 0) return

        const replay = new ReplayEngine(entries)
        engineRef.current = replay

        const renderer = new CanvasRenderer()
        rendererRef.current = renderer
        renderer.setTheme(effectiveTheme)
        renderer.init(el).then(() => {
            renderer.registerChar(charA.id, charA.name, charA.color)
            renderer.registerChar(charB.id, charB.name, charB.color)

            const f = replay.getFrameAt(0)
            renderer.render(f)
            renderer.setEntries(entries as never[])

            replay.onFrameCallback((f) => {
                renderer.render(f)
                const p = f.total > 0 ? f.time / f.total : 0
                setProgress(p)
                setCurrentTime(f.time)

                if (f.time >= f.total) setPlaying(false)

                onFrame?.(
                    f.eventIndex,
                    {
                        playing: f.time < f.total,
                        speed: speedRef.current,
                        progress: p,
                        currentTime: f.time,
                        turn: f.turn ?? replay.getCurrentTurn(),
                    },
                    f.chars,
                )
            })
        })

        return () => {
            engineRef.current?.destroy()
            rendererRef.current?.destroy()
            engineRef.current = null
            rendererRef.current = null
        }
    }, [charA, charB, entries, onFrame])

    useEffect(() => {
        engineRef.current?.setSpeed(speed)
        speedRef.current = speed
    }, [speed])

    const togglePlay = useCallback(() => {
        const replay = engineRef.current
        if (!replay) return
        if (replay.isPlaying) {
            replay.pause()
            setPlaying(false)
        } else {
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

    const seekPct = useCallback((pct: number) => {
        const replay = engineRef.current
        if (!replay) return
        replay.seek(pct * replay.totalDuration)
        setProgress(pct)
    }, [])

    useImperativeHandle(
        ref,
        () => ({
            togglePlay,
            setSpeed: changeSpeed,
            seek: seekPct,
            getState: () => ({ playing, speed, progress, currentTime, turn: 0 }),
            replay: () => {
                const replay = engineRef.current
                if (!replay) return
                // 先归零并渲染一帧，确保 progressbar 回 0（避免 React 批处理吞掉 seek 归零帧）
                replay.seek(0)
                setProgress(0)
                setCurrentTime(0)
                if (!replay.isPlaying) {
                    requestAnimationFrame(() => {
                        if (!replay.isPlaying) {
                            replay.play(speedRef.current)
                            setPlaying(true)
                        }
                    })
                }
            },
        }),
        [togglePlay, changeSpeed, seekPct, playing, speed, progress, currentTime],
    )

    return <div ref={canvasRef} className={`animation-canvas ${compact ? 'compact' : ''}`} />
})

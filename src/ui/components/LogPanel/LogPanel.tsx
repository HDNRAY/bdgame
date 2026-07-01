import { useRef, useState, useCallback, useEffect } from 'react'
import './LogPanel.scss'

interface LogPanelProps {
    logLines: string[]
    currentLine: number
    compact?: boolean
}

const LOG_INTERVAL = 150

export function LogPanel({ logLines, currentLine, compact }: LogPanelProps) {
    const logRef = useRef<HTMLDivElement>(null)
    const [autoScroll, setAutoScroll] = useState(true)
    const [logFontSize, setLogFontSize] = useState(13)
    const [displayCount, setDisplayCount] = useState(0)
    const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)
    const targetRef = useRef(currentLine)

    // 逐行动画：前进时 60ms/行，后退时立即追上
    useEffect(() => {
        targetRef.current = currentLine
        if (displayCount === currentLine) return
        if (displayCount > currentLine) {
            setTimeout(() => setDisplayCount(currentLine))
            return
        }
        clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
            setDisplayCount((c) => {
                if (c >= targetRef.current) {
                    clearInterval(timerRef.current!)
                    timerRef.current = undefined
                    return c
                }
                return c + 1
            })
        }, LOG_INTERVAL)
        return () => clearInterval(timerRef.current)
    }, [currentLine]) // eslint-disable-line react-hooks/exhaustive-deps

    // 自动滚动（依赖 displayCount，随动画滚动）
    useEffect(() => {
        if (autoScroll) {
            const el = logRef.current
            if (el) el.scrollTop = el.scrollHeight
        }
    }, [displayCount, autoScroll])

    const handleScroll = useCallback(() => {
        const el = logRef.current
        if (!el) return
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
        setAutoScroll(nearBottom)
    }, [])

    if (compact) return null

    return (
        <div className="log-panel">
            <div className="log-font-ctrl">
                <button className="ctrl-btn" onClick={() => setLogFontSize((s) => Math.max(9, s - 1))} title="缩小日志">
                    A−
                </button>
                <button
                    className="ctrl-btn"
                    onClick={() => setLogFontSize((s) => Math.min(24, s + 1))}
                    title="放大日志"
                >
                    A+
                </button>
            </div>
            <div ref={logRef} className="log" style={{ fontSize: logFontSize }} onScroll={handleScroll}>
                {logLines.slice(0, displayCount + 1).map((line, i) => (
                    <div key={i} className={`log-line ${i === displayCount ? 'current' : 'past'}`}>
                        {line}
                    </div>
                ))}
            </div>
        </div>
    )
}

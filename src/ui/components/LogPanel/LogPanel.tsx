import { useRef, useState, useCallback, useEffect } from 'react'
import './LogPanel.scss'

interface LogPanelProps {
    logLines: string[]
    currentLine: number
    compact?: boolean
}

export function LogPanel({ logLines, currentLine, compact }: LogPanelProps) {
    const logRef = useRef<HTMLDivElement>(null)
    const [autoScroll, setAutoScroll] = useState(true)
    const [logFontSize, setLogFontSize] = useState(13)

    // 自动滚动
    useEffect(() => {
        if (autoScroll) {
            const el = logRef.current
            if (el) el.scrollTop = el.scrollHeight
        }
    }, [currentLine, autoScroll])

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
                {logLines.slice(0, currentLine + 1).map((line, i) => (
                    <div key={i} className={`log-line ${i === currentLine ? 'current' : 'past'}`}>
                        {line}
                    </div>
                ))}
            </div>
        </div>
    )
}

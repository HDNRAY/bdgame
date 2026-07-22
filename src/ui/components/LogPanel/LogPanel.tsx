import { useRef, useState, useCallback, useEffect } from 'react'
import './LogPanel.scss'

interface LogPanelProps {
    logLines: string[]
    currentLine: number
    compact?: boolean
    /** 每条 log 行对应的 battle time (ms)，用于按实际时间间隔逐行动画 */
    lineTimelineMs?: number[]
    /** 播放速度，影响逐行动画速度 */
    speed?: number
}

const MIN_DELAY = 20
const MAX_DELAY = 2000
const FALLBACK_DELAY = 150

export function LogPanel({ logLines, currentLine, compact, lineTimelineMs, speed = 1 }: LogPanelProps) {
    const logRef = useRef<HTMLDivElement>(null)
    const [autoScroll, setAutoScroll] = useState(true)
    const [logFontSize, setLogFontSize] = useState(13)
    const [displayCount, setDisplayCount] = useState(0)
    const displayRef = useRef(displayCount)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const targetRef = useRef(currentLine)

    // 保持 ref 与 state 同步
    useEffect(() => { displayRef.current = displayCount }, [displayCount])

    // 逐行动画：按 battle time 间隔展示，后退时立即追上
    useEffect(() => {
        targetRef.current = currentLine
        const cur = displayRef.current
        if (cur === currentLine) return
        if (cur > currentLine) {
            const t = setTimeout(() => setDisplayCount(currentLine))
            return () => clearTimeout(t)
        }
        clearTimeout(timerRef.current)

        let cancelled = false
        const tick = () => {
            if (cancelled) return
            const c = displayRef.current
            if (c >= targetRef.current) return

            // 相同时间戳的行一次性跳过
            let next = c + 1
            if (lineTimelineMs) {
                const curTime = lineTimelineMs[c]
                while (next < targetRef.current && lineTimelineMs[next] === curTime) {
                    next++
                }
            }
            setDisplayCount(next)
            displayRef.current = next
            if (next >= targetRef.current) return

            // 按实际时间差（除以 speed）决定下一批的等待时间
            let delay = FALLBACK_DELAY
            if (lineTimelineMs && next < lineTimelineMs.length) {
                const gap = lineTimelineMs[next] - lineTimelineMs[c]
                delay = Math.max(MIN_DELAY, Math.min(MAX_DELAY, gap / speed))
            }
            timerRef.current = setTimeout(tick, delay)
        }

        timerRef.current = setTimeout(tick, MIN_DELAY)
        return () => {
            cancelled = true
            clearTimeout(timerRef.current)
        }
    }, [currentLine, lineTimelineMs, speed])

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
                {logLines.slice(0, Math.max(displayCount, currentLine) + 1).map((line, i) => (
                    <div key={i} className={`log-line ${i === currentLine ? 'current' : 'past'}`}>
                        {line}
                    </div>
                ))}
            </div>
        </div>
    )
}

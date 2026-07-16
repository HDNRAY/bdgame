import { useState, useEffect, useCallback, useRef } from 'react'

interface UseTypewriterOptions {
    /** 是否启用逐字效果（默认 true） */
    enabled?: boolean
    /** 每字间隔毫秒数（默认 30） */
    speed?: number
}

interface UseTypewriterReturn {
    /** 当前应显示的文本 */
    displayText: string
    /** 是否已完成 */
    done: boolean
    /** 跳过动画，立即显示全文 */
    skip: () => void
}

/**
 * 逐字显示 Hook
 * 将文本逐字打出，支持点击跳过
 */
export function useTypewriter(
    text: string,
    { enabled = true, speed = 30 }: UseTypewriterOptions = {},
): UseTypewriterReturn {
    const [pos, setPos] = useState(enabled ? 0 : text.length)
    const rafRef = useRef<number | null>(null)
    const lastTickRef = useRef(0)
    const posRef = useRef(pos)
    const doneRef = useRef(false)
    const versionRef = useRef(0) // 每次 text 变化递增，tick 用此判断是否过期
    posRef.current = pos

    const clearTimer = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
    }, [])

    const skip = useCallback(() => {
        clearTimer()
        doneRef.current = true
        setPos(text.length)
    }, [text.length, clearTimer])

    // text 变化时重置
    useEffect(() => {
        clearTimer()
        doneRef.current = false
        versionRef.current += 1
        if (!enabled || text.length === 0) {
            setPos(text.length)
            doneRef.current = true
            return
        }
        setPos(0)
    }, [text, enabled, clearTimer])

    // 逐字推进 — 使用 rAF
    useEffect(() => {
        if (!enabled || doneRef.current) return

        const version = versionRef.current
        posRef.current = 0
        lastTickRef.current = performance.now()

        function tick(now: number) {
            if (doneRef.current || versionRef.current !== version) return

            const elapsed = now - lastTickRef.current
            if (elapsed >= speed) {
                lastTickRef.current = now
                posRef.current += 1
                setPos(posRef.current)

                if (posRef.current >= text.length) {
                    doneRef.current = true
                    return
                }
            }

            rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
        }
    }, [text, enabled, speed])

    return {
        displayText: text.slice(0, pos),
        done: pos >= text.length,
        skip,
    }
}

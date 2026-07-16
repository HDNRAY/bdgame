import { useEffect, useCallback, useRef, useReducer } from 'react'

interface UseTypewriterOptions {
    enabled?: boolean
    speed?: number
}

interface UseTypewriterReturn {
    displayText: string
    done: boolean
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
    const [pos, tick] = useReducer(
        (s: number, a: 'tick' | 'skip' | 'reset') => {
            switch (a) {
                case 'tick':
                    return s + 1
                case 'skip':
                    return text.length
                case 'reset':
                    return enabled && text.length > 0 ? 0 : text.length
            }
        },
        enabled ? 0 : text.length,
    )
    const posRef = useRef(pos)
    const rafRef = useRef<number | null>(null)
    const lastTickRef = useRef(0)
    const doneRef = useRef(false)
    const versionRef = useRef(0)

    // 同步 pos 到 ref
    useEffect(() => {
        posRef.current = pos
    }, [pos])

    const clearTimer = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
    }, [])

    const skip = useCallback(() => {
        clearTimer()
        doneRef.current = true
        tick('skip')
    }, [clearTimer])

    // text 变化时重置
    useEffect(() => {
        clearTimer()
        doneRef.current = false
        versionRef.current += 1
        tick('reset')
        if (!enabled || text.length === 0) {
            doneRef.current = true
        }
    }, [text, enabled, clearTimer])

    // 逐字推进 — 使用 rAF
    useEffect(() => {
        if (!enabled || doneRef.current) return

        const version = versionRef.current
        lastTickRef.current = performance.now()

        function tickRaf(now: number) {
            if (doneRef.current || versionRef.current !== version) return

            const elapsed = now - lastTickRef.current
            if (elapsed >= speed) {
                lastTickRef.current = now
                posRef.current += 1
                tick('tick')

                if (posRef.current >= text.length) {
                    doneRef.current = true
                    return
                }
            }

            rafRef.current = requestAnimationFrame(tickRaf)
        }

        rafRef.current = requestAnimationFrame(tickRaf)
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

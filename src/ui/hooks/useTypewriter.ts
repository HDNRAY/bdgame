import { useEffect, useCallback, useRef, useReducer } from 'react'

interface UseTypewriterOptions {
    enabled?: boolean
    speed?: number
    /**
     * 跳过（`skip()` 或 `onSkipKey` 的 hook）时的附带动作 —— 目前只有「把滚动容器复位」这一处用途。
     * 放在 tick 之前做，且 `skip` 的引用保持稳定（回调存在 ref 里），
     * 这样调用方不必为它包 useCallback，也不会把下面的打字动画 effect 重跑一遍。
     */
    onSkip?: () => void
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
    { enabled = true, speed = 30, onSkip }: UseTypewriterOptions = {},
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

    /** onSkip 每次渲染都可能是新函数：存进 ref，让 skip 的身份保持不变 */
    const onSkipRef = useRef(onSkip)
    useEffect(() => {
        onSkipRef.current = onSkip
    }, [onSkip])

    const skip = useCallback(() => {
        clearTimer()
        doneRef.current = true
        onSkipRef.current?.()
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

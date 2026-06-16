import { useCallback, useRef, useState } from 'react'

/** Tooltip 显示状态 hook */
export function useTooltip() {
    const [show, setShow] = useState(false)
    const [pos, setPos] = useState({ x: 0, y: 0 })
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const onEnter = useCallback((e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setPos({ x: rect.right + 8, y: rect.top })
        timerRef.current = setTimeout(() => setShow(true), 200)
    }, [])

    const onLeave = useCallback(() => {
        clearTimeout(timerRef.current)
        setShow(false)
    }, [])

    return { show, pos, onEnter, onLeave }
}

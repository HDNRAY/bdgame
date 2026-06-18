import { type ReactNode, useRef, useState, useCallback, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { computePosition, autoUpdate, offset, shift, autoPlacement } from '@floating-ui/dom'
import './Tooltip.scss'

interface TooltipProps {
    content: ReactNode
    children: ReactNode
    delay?: number
}

/** 通用 Tooltip — 手动 computePosition + autoUpdate，避免 React 19 refs warning */
export function Tooltip({ content, children, delay = 200 }: TooltipProps) {
    const [show, setShow] = useState(false)
    const [pos, setPos] = useState<CSSProperties>({})
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const refEl = useRef<HTMLSpanElement>(null)
    const floatEl = useRef<HTMLDivElement>(null)
    const cleanupRef = useRef<(() => void) | null>(null)

    // 每次显示时重新计算位置 + 启动 autoUpdate
    useEffect(() => {
        if (!show || !refEl.current || !floatEl.current) return
        const ref = refEl.current
        const flt = floatEl.current
        cleanupRef.current = autoUpdate(ref, flt, () => {
            computePosition(ref, flt, {
                placement: 'right',
                strategy: 'fixed',
                middleware: [
                    offset(6),
                    autoPlacement({ allowedPlacements: ['right', 'left', 'bottom', 'top'] }),
                    shift({ padding: 6 }),
                ],
            }).then(({ x, y }) => setPos({ left: x, top: y }))
        })
        return () => {
            cleanupRef.current?.()
            cleanupRef.current = null
        }
    }, [show])

    const onEnter = useCallback(() => {
        timerRef.current = setTimeout(() => setShow(true), delay)
    }, [delay])

    const onLeave = useCallback(() => {
        clearTimeout(timerRef.current)
        setShow(false)
    }, [])

    return (
        <span ref={refEl} className="tooltip-wrapper" onMouseEnter={onEnter} onMouseLeave={onLeave}>
            {children}
            {content &&
                createPortal(
                    <div
                        ref={floatEl}
                        className={`tooltip-popup${show ? ' show' : ''}`}
                        style={{ ...pos, position: 'fixed', display: show ? '' : 'none' }}
                    >
                        {content}
                    </div>,
                    document.body,
                )}
        </span>
    )
}

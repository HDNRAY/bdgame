import { type ReactNode, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.scss'

interface TooltipProps {
    content: ReactNode
    children: ReactNode
    /** 延迟显示（ms），默认 200 */
    delay?: number
}

/** 通用 Tooltip 容器 — 鼠标悬停时显示内容卡片（Portal 到 document.body） */
export function Tooltip({ content, children, delay = 200 }: TooltipProps) {
    const [show, setShow] = useState(false)
    const [pos, setPos] = useState({ x: 0, y: 0 })
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const wrapperRef = useRef<HTMLSpanElement>(null)

    const onEnter = useCallback(
        (e: React.MouseEvent) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setPos({ x: rect.right + 8, y: rect.top })
            timerRef.current = setTimeout(() => setShow(true), delay)
        },
        [delay],
    )

    const onLeave = useCallback(() => {
        clearTimeout(timerRef.current)
        setShow(false)
    }, [])

    return (
        <span ref={wrapperRef} className="tooltip-wrapper" onMouseEnter={onEnter} onMouseLeave={onLeave}>
            {children}
            {show &&
                content &&
                createPortal(
                    <div className="tooltip-popup show" style={{ left: pos.x, top: pos.y }}>
                        {content}
                    </div>,
                    document.body,
                )}
        </span>
    )
}

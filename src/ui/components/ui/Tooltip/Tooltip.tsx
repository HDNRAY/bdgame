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
            const el = e.currentTarget as HTMLElement
            const rect = el.getBoundingClientRect()
            const tipW = 320 // 保守估计（CSS max-width）
            const tipH = 200
            const gap = 6

            const vw = document.documentElement.clientWidth
            const vh = document.documentElement.clientHeight
            // 四个方向的可用空间（原始空间，不减去 popup 尺寸，用于公平比较）
            const spaces = [
                { x: rect.right + gap, y: rect.top, space: vw - rect.right },
                { x: rect.left - gap - tipW, y: rect.top, space: rect.left },
                { x: rect.left, y: rect.bottom + gap, space: vh - rect.bottom },
                { x: rect.left, y: rect.top - gap - tipH, space: rect.top },
            ] as const

            // 选空间最大的方向
            const best = { ...spaces.reduce((a, b) => (a.space > b.space ? a : b)) }
            // 如果所有方向都放不下，把 popup 钳在视口内
            best.x = Math.max(gap, Math.min(best.x, vw - tipW - gap))
            best.y = Math.max(gap, Math.min(best.y, vh - tipH - gap))
            setPos({ x: best.x, y: best.y })

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

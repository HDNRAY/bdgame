import { type ReactNode, useRef, useState, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { computePosition, offset, shift } from '@floating-ui/dom'
import './Tooltip.scss'

let _zIndex = 9999

interface TooltipProps {
    content: ReactNode
    children: ReactNode
}

/** 通用 Tooltip — 用一个 mousemove 监听处理所有显隐逻辑 */
export function Tooltip({ content, children }: TooltipProps) {
    const [show, setShow] = useState(false)
    const [pos, setPos] = useState<CSSProperties>({})
    const [zIndex, setZIndex] = useState(9999)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const refEl = useRef<HTMLSpanElement>(null)
    const floatEl = useRef<HTMLDivElement>(null)

    // 显示时一次性计算位置 + 递增 zIndex
    useEffect(() => {
        if (!show || !refEl.current || !floatEl.current) return
        _zIndex++
        setZIndex(_zIndex)
        computePosition(refEl.current, floatEl.current, {
            placement: 'bottom',
            strategy: 'fixed',
            middleware: [offset({ mainAxis: 4, crossAxis: 0 }), shift({ padding: 6 })],
        }).then(({ x, y }) => setPos({ left: x, top: y }))
    }, [show])

    // 单一 document mousemove 监听：检测鼠标是否在 trigger/popup 上
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const allTargets = document.elementsFromPoint(e.clientX, e.clientY)
            const overTrigger = allTargets.some((t) => refEl.current?.contains(t))
            const overSelf = allTargets.some((t) => floatEl.current?.contains(t))
            // 鼠标在任意 tooltip-popup 上时保持显示（解决嵌套 tooltip）
            const overAnyPopup = allTargets.some((t) => t.closest('.tooltip-popup'))

            clearTimeout(timerRef.current)
            if (overTrigger) {
                if (!show) setShow(true)
            } else if (overSelf || (show && overAnyPopup)) {
                // 在自己 popup 上或任意 tooltip popup 上 → 保持显示
            } else {
                if (show) {
                    timerRef.current = setTimeout(() => setShow(false), 200)
                }
            }
        }
        document.addEventListener('mousemove', onMove)
        return () => {
            document.removeEventListener('mousemove', onMove)
            clearTimeout(timerRef.current)
        }
    }, [show])

    return (
        <span ref={refEl} className="tooltip-wrapper">
            {children}
            {content &&
                createPortal(
                    <div
                        ref={floatEl}
                        className={`tooltip-popup${show ? ' show' : ''}`}
                        style={{ ...pos, position: 'fixed', zIndex, display: show ? '' : 'none' }}
                    >
                        {content}
                    </div>,
                    document.body,
                )}
        </span>
    )
}

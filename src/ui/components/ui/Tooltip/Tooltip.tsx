import { type ReactNode, useRef, useState, useCallback, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { computePosition, offset, shift, autoPlacement } from '@floating-ui/dom'
import './Tooltip.scss'

let _zIndex = 9999

interface TooltipProps {
    content: ReactNode
    children: ReactNode
}

const HIDE_DELAY = 80

/** 通用 Tooltip */
export function Tooltip({ content, children }: TooltipProps) {
    const [show, setShow] = useState(false)
    const [pos, setPos] = useState<CSSProperties>({})
    const [zIndex, setZIndex] = useState(9999)
    const refEl = useRef<HTMLSpanElement>(null)
    const floatEl = useRef<HTMLDivElement>(null)
    const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

    const updatePos = useCallback(() => {
        if (!refEl.current || !floatEl.current) return
        _zIndex++
        setZIndex(_zIndex)
        computePosition(refEl.current, floatEl.current, {
            placement: 'bottom',
            strategy: 'fixed',
            middleware: [
                offset({ mainAxis: 4 }),
                autoPlacement({ allowedPlacements: ['left', 'right', 'top', 'bottom'] }),
                shift({ padding: 6 }),
            ],
        }).then(({ x, y }) => setPos({ left: x, top: y }))
    }, [])

    const cancelHide = useCallback(() => clearTimeout(hideTimer.current), [])

    const delayHide = useCallback(() => {
        hideTimer.current = setTimeout(() => setShow(false), HIDE_DELAY)
    }, [])

    const showTooltip = useCallback(() => {
        cancelHide()
        setShow(true)
        requestAnimationFrame(updatePos)
    }, [cancelHide, updatePos])

    /** popup 离开时检查是否进了子 tooltip 区域，进了就不隐藏 */
    const onPopupLeave = useCallback((e: React.PointerEvent) => {
        const overPopup = document.elementsFromPoint(e.clientX, e.clientY).some((el) => el.closest('.tooltip-popup'))
        if (!overPopup) setShow(false)
    }, [])

    return (
        <span ref={refEl} className="tooltip-wrapper" onPointerEnter={showTooltip} onPointerLeave={delayHide}>
            {children}
            {content &&
                createPortal(
                    <div
                        ref={floatEl}
                        className={`tooltip-popup${show ? ' show' : ''}`}
                        style={{ ...pos, position: 'fixed', zIndex, display: show ? '' : 'none' }}
                        onPointerEnter={cancelHide}
                        onPointerLeave={onPopupLeave}
                    >
                        {content}
                    </div>,
                    document.body,
                )}
        </span>
    )
}

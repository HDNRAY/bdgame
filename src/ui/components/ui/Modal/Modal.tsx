// ════════════════════════════════════════
//  Modal — 通用弹层外壳（modal / fullscreen 两变体）
//
//  视觉基准 = 首页「玩法」弹窗（.gameplay-modal 的面板值：max-width min(56rem, 92vw)、
//  --color-bg-panel + --color-border + --radius-lg + --shadow-lg）；
//  语义基准 = TournamentPanel（role="dialog" + aria-labelledby + Esc + 独立背景层）。
//
//  三条与「模态对话」不同的口径（见 docs/superpowers/specs/2026-10-09-bottom-footer-design.md §3.3）：
//   1. **不写 `aria-modal="true"`**：常驻底栏在弹层之上、始终可点，语义上不是模态对话；
//   2. **Esc 用捕获阶段 + stopPropagation**：下层可能还开着 TournamentPanel（它在 window 上听
//      Esc），不拦下来就会「一按 Esc 连关两层」；
//   3. **弹层高度/底边扣 `--bottom-bar-h`**：底栏是 fixed、不参与内容留白，所以面板自己让出这条高度。
//
//  焦点：开时把焦点放进面板（`tabIndex={-1}`）；关时归还给打开前的 `document.activeElement`。
//  关闭前不会做 focus trap —— 底栏必须能点，这是设计（D1）。
//
//  纯 SSR 环境（无 jsdom）下 useEffect 不跑，渲染结果依然完整（role / aria / 标题 / 关闭钮）。
// ════════════════════════════════════════

import { useEffect, useId, useRef, type ReactNode } from 'react'
import './Modal.scss'

interface ModalProps {
    /** 头部标题（同时是 aria-labelledby 的目标） */
    title: string
    onClose: () => void
    children: ReactNode
    /** 底部动作区（可选） */
    footer?: ReactNode
    /** modal = 居中卡片；fullscreen = 铺满「视口 − 底栏」、圆角 0 */
    variant?: 'modal' | 'fullscreen'
    /** 追加在 .modal-panel 之后的类名（调用方做局部排版） */
    className?: string
    /** 追加在 .modal-body 之后的类名（调用方做局部排版） */
    bodyClassName?: string
}

export function Modal({ title, onClose, children, footer, variant = 'modal', className, bodyClassName }: ModalProps) {
    const titleId = useId()
    const panelRef = useRef<HTMLDivElement>(null)
    /** 打开前的焦点归属（关闭时还回去） */
    const restoreRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        panelRef.current?.focus()
        return () => {
            const prev = restoreRef.current
            // 打开它的那个按钮可能已经不在了（例如切到另一个弹层）：只在还挂在文档里时归还
            if (prev && prev.isConnected) prev.focus()
        }
    }, [])

    // Esc 关闭：捕获阶段拦下，别让下层弹层（TournamentPanel）跟着一起关
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            onClose()
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
    }, [onClose])

    const panelClass = `modal-panel modal-panel-${variant}${className ? ` ${className}` : ''}`
    const bodyClass = `modal-body${bodyClassName ? ` ${bodyClassName}` : ''}`

    return (
        <div className={`modal-overlay modal-overlay-${variant}`} onClick={onClose}>
            <div
                className={panelClass}
                role="dialog"
                aria-labelledby={titleId}
                tabIndex={-1}
                ref={panelRef}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <div className="modal-title" id={titleId}>
                        {title}
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="关闭">
                        ×
                    </button>
                </div>
                <div className={bodyClass}>{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    )
}

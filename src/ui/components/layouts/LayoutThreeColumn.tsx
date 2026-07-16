import type { ReactNode } from 'react'
import './LayoutThreeColumn.scss'

interface LayoutThreeColumnProps {
    left?: ReactNode
    center: ReactNode
    right?: ReactNode
    header?: ReactNode
    className?: string
}

/**
 * 三栏布局 — 左侧栏 + 中栏 + 右侧栏
 * 用于 BattlePanel / SelectionPanel
 * 侧栏使用 --sidebar-width，可被上层覆盖
 */
export function LayoutThreeColumn({ left, center, right, header, className = '' }: LayoutThreeColumnProps) {
    return (
        <div className={`layout-3col ${className}`}>
            {header && <div className="layout-3col-header">{header}</div>}
            <div className="layout-3col-body">
                {left && <aside className="layout-3col-side layout-3col-side--left">{left}</aside>}
                <main className="layout-3col-center">{center}</main>
                {right && <aside className="layout-3col-side layout-3col-side--right">{right}</aside>}
            </div>
        </div>
    )
}

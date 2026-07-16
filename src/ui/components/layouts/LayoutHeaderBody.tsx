import type { ReactNode } from 'react'
import './LayoutHeaderBody.scss'

interface LayoutHeaderBodyProps {
    header?: ReactNode
    body: ReactNode
    sidebar?: ReactNode
    sidebarWidth?: string
    sidebarMode?: 'view' | 'build'
    className?: string
}

/**
 * 上下+侧栏布局 — header + body + 可选侧栏
 * 用于 RogueliteScreen
 * 支持 portrait/landscape 响应式（通过 useOrientation 控制 className）
 */
export function LayoutHeaderBody({
    header,
    body,
    sidebar,
    sidebarWidth,
    sidebarMode = 'view',
    className = '',
}: LayoutHeaderBodyProps) {
    return (
        <div className={`layout-hb ${className}`}>
            {header && <header className="layout-hb-header">{header}</header>}
            <div className="layout-hb-body">
                <div className="layout-hb-content">{body}</div>
                {sidebar && (
                    <aside
                        className={`layout-hb-sidebar layout-hb-sidebar--${sidebarMode}`}
                        style={sidebarWidth ? { flexBasis: sidebarWidth } : undefined}
                    >
                        {sidebar}
                    </aside>
                )}
            </div>
        </div>
    )
}

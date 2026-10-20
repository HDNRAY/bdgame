import type { HTMLAttributes, ReactNode } from 'react'
import './Panel.scss'

/** 面板变体：panel = 面板表面；raised = 浮起表面 + 硬阴影 */
export type PanelVariant = 'panel' | 'raised'

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
    variant?: PanelVariant
    children: ReactNode
}

/**
 * 通用面板：只负责表面 / 圆角 / 内边距 / 可选高度，不关心业务内容。
 * 默认不描边（UI 改版口径）：分隔交给 surface + 硬阴影 + 间距。
 */
export function Panel({ variant = 'panel', className, children, ...rest }: PanelProps) {
    const classes = `ui-panel ui-panel-${variant}${className ? ` ${className}` : ''}`
    return (
        <div className={classes} {...rest}>
            {children}
        </div>
    )
}

import { type ReactNode } from 'react'
import { Tooltip } from '../Tooltip/Tooltip'
import './EntityItem.scss'

interface EntityItemProps {
    tooltip: ReactNode
    name: string
    children?: ReactNode
}

/** 实体列表项 — 显示 "▸ 名称"，包裹 Tooltip，支持后缀信息 */
export function EntityItem({ tooltip, name, children }: EntityItemProps) {
    return (
        <Tooltip content={tooltip}>
            <div className="entity-item">
                <span className="entity-item-name">▸ {name}</span>
                {children && <span className="entity-item-meta">{children}</span>}
            </div>
        </Tooltip>
    )
}

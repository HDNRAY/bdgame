import { type ReactNode } from 'react'
import { Tooltip } from '../Tooltip/Tooltip'
import { entityTooltipContent } from '../../tooltip-contents/entityTooltipContent'
import { EntityDef, EntityType } from '../../../../bridge/entity-tooltip'
import './EntityItem.scss'

interface EntityItemProps {
    entity: EntityDef
    type: EntityType
    children?: ReactNode
    onClick?: () => void
}

/** 实体标签 — 传入实体数据+类型，自动选择 tooltip，标签样式显示 */
export function EntityItem({ entity, type, children, onClick }: EntityItemProps) {
    const tooltip = entityTooltipContent(entity, type)

    return (
        <Tooltip content={tooltip}>
            <span className="entity-item" onClick={onClick} role={onClick ? 'button' : undefined}>
                {entity.name}
                {children && <span className="entity-item-meta">{children}</span>}
            </span>
        </Tooltip>
    )
}

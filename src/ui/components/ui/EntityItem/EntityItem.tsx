import { type ReactNode } from 'react'
import type { EntityDef, EntityType } from '../../../entity-tooltip'
import { Tooltip } from '../Tooltip/Tooltip'
import { WeaponTooltip } from '../../tooltip-contents/WeaponTooltip'
import { ActionTooltip } from '../../tooltip-contents/ActionTooltip'
import { PassiveTooltip } from '../../tooltip-contents/PassiveTooltip'
import { ArtifactTooltip } from '../../tooltip-contents/ArtifactTooltip'
import './EntityItem.scss'

interface EntityItemProps {
    entity: EntityDef
    type: EntityType
    children?: ReactNode
    onClick?: () => void
}

/** 实体标签 — 传入实体数据+类型，自动选择 tooltip，标签样式显示 */
export function EntityItem({ entity, type, children, onClick }: EntityItemProps) {
    const tooltip = (() => {
        switch (type) {
            case 'weapon':
                return <WeaponTooltip weapon={entity as any} />
            case 'action':
                return <ActionTooltip action={entity as any} />
            case 'passive':
                return <PassiveTooltip passive={entity as any} />
            case 'artifact':
                return <ArtifactTooltip artifact={entity as any} />
        }
    })()

    return (
        <Tooltip content={tooltip}>
            <span className="entity-item" onClick={onClick} role={onClick ? 'button' : undefined}>
                {(entity as any).name}
                {children && <span className="entity-item-meta">{children}</span>}
            </span>
        </Tooltip>
    )
}

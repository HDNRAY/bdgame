import { type ReactNode } from 'react'
import { Tooltip } from '../Tooltip/Tooltip'
import { WeaponTooltip } from '../../tooltip-contents/WeaponTooltip'
import { ActionTooltip } from '../../tooltip-contents/ActionTooltip'
import { PassiveTooltip } from '../../tooltip-contents/PassiveTooltip'
import { ArtifactTooltip } from '../../tooltip-contents/ArtifactTooltip'
import { BuffTooltip } from '../../tooltip-contents/BuffTooltip'
import { WeaponDef } from '../../../../engine/data/weapons/weapons'
import { ActionDefinition, Artifact, Passive } from '../../../../engine'
import type { BuffDef } from '../../../../engine/data/buffs/types'
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
    const tooltip = (() => {
        switch (type) {
            case 'weapon':
                return <WeaponTooltip weapon={entity as WeaponDef} />
            case 'action':
                return <ActionTooltip action={entity as ActionDefinition} />
            case 'passive':
                return <PassiveTooltip passive={entity as Passive} />
            case 'artifact':
                return <ArtifactTooltip artifact={entity as Artifact} />
            case 'buff':
                return <BuffTooltip buff={entity as BuffDef} />
        }
    })()

    return (
        <Tooltip content={tooltip}>
            <span className="entity-item" onClick={onClick} role={onClick ? 'button' : undefined}>
                {entity.name}
                {children && <span className="entity-item-meta">{children}</span>}
            </span>
        </Tooltip>
    )
}

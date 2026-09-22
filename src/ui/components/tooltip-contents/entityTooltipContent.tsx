import type { ReactNode } from 'react'
import { WeaponTooltip } from './WeaponTooltip'
import { ActionTooltip } from './ActionTooltip'
import { PassiveTooltip } from './PassiveTooltip'
import { ArtifactTooltip } from './ArtifactTooltip'
import { BuffTooltip } from './BuffTooltip'
import type { WeaponDef } from '../../../data/weapons/weapons'
import type { ActionDefinition, Artifact, Passive } from '../../../engine'
import type { BuffDef } from '../../../data/buffs/types'
import type { EntityDef, EntityType } from '../../../bridge/entity-tooltip'

/**
 * 按实体类型取「完整内容」——tooltip 弹层与图鉴内联卡片共用同一份，
 * 所以图鉴里看到的就是 tooltip 里的全部信息（名字/标签/属性/效果/触发…）。
 */
export function entityTooltipContent(entity: EntityDef, type: EntityType): ReactNode {
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
        default:
            return null
    }
}

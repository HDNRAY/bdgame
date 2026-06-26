import { getAction } from '../engine/data/actions'
import { getPassive } from '../engine/data/passives'
import { getArtifact } from '../engine/data/artifacts'
import { getWeapon } from '../engine/data/weapons/weapons'
import type { ActionDefinition } from '../engine/entities/action'
import type { Passive } from '../engine/entities/passive'
import type { Artifact } from '../engine/entities/artifact'
import type { WeaponDef } from '../engine/data/weapons/weapons'

export type EntityDef = ActionDefinition | Passive | Artifact | WeaponDef
export type EntityType = 'action' | 'passive' | 'artifact' | 'weapon'

/** 根据实体 ID 和类型获取实体定义。 */
export function getEntity(id: string, type: string): EntityDef | undefined {
    switch (type) {
        case 'action':
            return getAction(id)
        case 'passive':
            return getPassive(id)
        case 'artifact':
            return getArtifact(id)
        case 'weapon':
            return getWeapon(id)
        default:
            throw new Error(`getEntity: unknown entity type "${type}"`)
    }
}

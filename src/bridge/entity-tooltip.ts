import { getAction } from '../data/actions'
import { getPassive } from '../data/passives'
import { getArtifact } from '../data/artifacts'
import { getWeapon } from '../data/weapons/weapons'
import { getBuff } from '../data/buffs'
import type { ActionDefinition } from '../engine/entities/action'
import type { Passive } from '../engine/entities/passive'
import type { Artifact } from '../engine/entities/artifact'
import type { WeaponDef } from '../data/weapons/weapons'
import type { BuffDef } from '../data/buffs/types'

export type EntityDef = ActionDefinition | Passive | Artifact | WeaponDef | BuffDef
export type EntityType = 'action' | 'passive' | 'artifact' | 'weapon' | 'buff'

const ENTITY_TYPES = ['weapon', 'action', 'passive', 'artifact', 'buff'] as const

export function isEntityType(type: string): type is EntityType {
    return (ENTITY_TYPES as readonly string[]).includes(type)
}

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
        case 'buff':
            return getBuff(id)
        default:
            throw new Error(`getEntity: unknown entity type "${type}"`)
    }
}

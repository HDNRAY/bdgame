import type { AttrName } from './attributes'
import type { GameEntity } from './base'

/** 奇物 */
export interface Artifact extends GameEntity {
    id: string
    name: string
    description: string
    statMods?: Partial<Record<AttrName, number>>
}

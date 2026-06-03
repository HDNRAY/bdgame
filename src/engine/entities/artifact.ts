import type { AttrName } from './attributes'

/** 奇物 */
export interface Artifact {
    id: string
    name: string
    description: string
    statMods?: Partial<Record<AttrName, number>>
}

import type { AttrName } from './attributes'
import type { GameEntity } from './base'

/** 功法 / 被动技能 */
export interface Passive extends GameEntity {
    id: string
    name: string
    description: string
    /** 常驻属性修正 */
    statMods?: Partial<Record<AttrName, number>>
    tags?: string[]
}

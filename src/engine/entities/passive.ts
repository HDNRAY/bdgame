import type { AttrName } from './attributes'

/** 功法 / 被动技能 */
export interface Passive {
    id: string
    name: string
    /** 常驻属性修正 */
    statMods?: Partial<Record<AttrName, number>>
    tags?: string[]
}

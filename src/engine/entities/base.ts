import { AttrName } from './attributes'
import type { Tag } from './tag'

/** 所有可收集/可装备物品的基类 */
export interface GameEntity {
    id: string
    name: string
    description: string
    /** 标签（用于分类/条件过滤） */
    tags: Tag[]
    /** 属性门槛（不够则不装备/使用） */
    requireAttrsMin?: Partial<Record<AttrName, number>>
}

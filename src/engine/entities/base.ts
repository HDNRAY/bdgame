import type { Tag } from './action'

/** 所有可收集/可装备物品的基类 */
export interface GameEntity {
    id: string
    name: string
    description: string
    /** 标签（用于分类/条件过滤） */
    tags: Tag[]
}

/** 召唤物定义（武器/功法/奇物携带此字段来召唤物体） */
import type { ActionDefinition } from './action'

export interface SummonDef {
    id: string
    name: string
    maxCount: number
    /** 召唤物使用的招式 ID */
    actionId: string
    /** 构造期解析的动作副本（引擎优先使用） */
    action?: ActionDefinition
}

/** 运行时召唤物实例 */
export interface SummonInstance {
    id: string
    ownerId: string
    index: number
}

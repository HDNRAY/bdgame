/** 召唤物定义（武器/功法/奇物携带此字段来召唤物体） */
export interface SummonDef {
    id: string
    name: string
    maxCount: number
    apCost: number
    /** 召唤物使用的招式 ID */
    actionId: string
}

/** 运行时召唤物实例 */
export interface SummonInstance {
    id: string
    ownerId: string
    defId: string
    index: number
}

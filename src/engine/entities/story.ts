import type { Tag } from './tag'
import type { RewardType } from './reward'

/** 节点覆盖配置：故事对某个节点的特殊行为 */
export interface NodeOverride {
    /** 该节点给的修炼点（不设则走默认） */
    cultPoints?: number
    /** 强制奖励类型 */
    forceRewardType?: RewardType
    /** 直接覆盖该节点的 3 个选择项 */
    choices?: { id: string; name: string; desc: string; tags?: Tag[] }[]
    /** boss ID 覆盖 */
    bossId?: string
    /** 叙事文案覆盖（节点2/3等固定节点使用） */
    flavorText?: string

    // TODO: 后续实现故事强制事件功能
    // forceEventIds?: string[]  // 优先级最高的事件 ID 列表
}

/** 角色故事定义 */
export interface Story {
    id: string
    name: string
    characterName: string
    desc: string
    /** 内部备注：隐藏机制、剧情设计（不展示给玩家） */
    comment?: string
    /** 关联标签 */
    tags?: Tag[]
    /**
     * 节点行为钩子。问故事："当前是节点 N，你有没有特殊配置？"
     * 返回 undefined 表示走引擎默认逻辑。
     */
    getNodeOverride?: (nodeIndex: number) => NodeOverride | undefined
}

import type { RewardType } from './reward'

// ════════════════════════════════════════
//  事件定义
// ════════════════════════════════════════

export type EventType = 'combat' | 'boss' | 'story' | 'heal' | 'forge'

export interface EventDefBase {
    id: string
    name: string
    weight?: number
    minNode?: number
    maxNode?: number
    maxCount?: number
    condition?: (ctx: EventContext) => boolean
}

export interface CombatEventDef extends EventDefBase {
    type: 'combat'
    enemyId?: string
    enemyPool?: string[]
    rewardType?: RewardType
}

export interface BossEventDef extends EventDefBase {
    type: 'boss'
    enemyId: string
    rewardType: RewardType
}

/** 事件步骤类型 */
export type EventStepType = 'narrative' | 'choice'

export interface EventStepChoice {
    label: string
    description?: string
    chance?: number // 成功率 (0-1, 缺省=1.0)
    success?: EventEffect[] // 成功时应用的效果
    failure?: EventEffect[] // 失败时应用的效果
    condition?: (ctx: EventContext) => boolean
    next?: string | Record<number, string> // 该选项导向的下一步
}

export interface EventStep {
    id: string
    type: EventStepType

    // narrative 专用
    text?: string // 叙事文本

    // choice 专用
    prompt?: string // 选择提示文本
    choices?: EventStepChoice[] // 可选分支

    // 通用字段
    effects?: EventEffect[] // 步骤完成时应用的效果
    next?: string | Record<number, string> // 下一步 ID（choice 时为 choiceIndex -> stepId 映射）
}

export interface InteractiveEventDef extends EventDefBase {
    type: 'story'
    steps: Record<string, EventStep> // stepId -> step 映射
    firstStep: string // 起始步骤 ID

    // TODO: 后续实现故事变体和可用故事限制
    // availableStories?: string[]  // 只在哪些故事中出现，undefined = 全局可用
    // storyVariants?: Record<string, Partial<EventStep>>  // storyId -> 步骤覆盖
}

export interface StoryEventDef extends EventDefBase {
    type: 'story'
    description: string
    effects?: EventEffect[]
    storyIds?: string[]
    requireFlags?: Record<string, boolean>
}

export interface HealEventDef extends EventDefBase {
    type: 'heal'
    description: string
    effects: EventEffect[]
}

export interface ForgeEventDef extends EventDefBase {
    type: 'forge'
    description: string
    effects: EventEffect[]
}

export type EventDef =
    | CombatEventDef
    | BossEventDef
    | InteractiveEventDef
    | StoryEventDef
    | HealEventDef
    | ForgeEventDef

// ════════════════════════════════════════
//  事件选项 & 效果
// ════════════════════════════════════════

export type EventEffect =
    | { type: 'heal'; value: number }
    | { type: 'wound'; value: number }
    | { type: 'cult_points'; value: number }
    | { type: 'grant_reward'; rewardType: RewardType }
    | { type: 'set_flag'; key: string; value: boolean }

// ════════════════════════════════════════
//  事件上下文
// ════════════════════════════════════════

export interface EventContext {
    nodeIndex: number
    storyId: string
    flags: Record<string, boolean>
    injury: number
    rewardCount: number
}

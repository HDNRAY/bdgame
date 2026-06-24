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

export interface StoryEventDef extends EventDefBase {
    type: 'story'
    description: string
    choices?: EventChoice[]
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

export type EventDef = CombatEventDef | BossEventDef | StoryEventDef | HealEventDef | ForgeEventDef

// ════════════════════════════════════════
//  事件选项 & 效果
// ════════════════════════════════════════

export interface EventChoice {
    label: string
    description: string
    effects?: EventEffect[]
    chance?: number
    failEffects?: EventEffect[]
    requireFlags?: Record<string, boolean>
}

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

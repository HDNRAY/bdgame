import type { Reward } from './reward'
import type { CharacterBuild } from './character-build'

// ════════════════════════════════════════
//  节点类型
// ════════════════════════════════════════

export type NodeType = 'bg' | 'weapon' | 'first_action' | 'event' | 'boss'

/** 地图节点（极简骨架，仅含 index + type） */
export interface MapNode {
    index: number // 1-33
    type: NodeType
}

/** 节点日志条目 */
export interface NodeLogEntry {
    nodeIndex: number
    nodeType: NodeType
    chosenEventId?: string
    chosenReward?: Reward
    cultPointsGained?: number
    battleResult?: 'win' | 'lose'
    enemyId?: string
    injuryGained?: number
}

/** 引擎执行阶段 */
export type GamePhase = 'idle' | 'interactive' | 'rewarding' | 'finished'

/** 交互事件的运行状态 */
export interface InteractiveState {
    eventId: string
    currentStepId: string
    history: Array<{ stepId: string; choiceIndex?: number; choiceSuccess?: boolean }>
}

/** 运行状态（build 为唯一数据源） */
export interface RunState {
    phase: GamePhase
    build: CharacterBuild
    unspentCultPoints: number
    injury: number
    flags: Record<string, boolean>
    log: NodeLogEntry[]

    /** 交互事件状态（phase === 'interactive' 时存在） */
    currentInteractive?: InteractiveState
}

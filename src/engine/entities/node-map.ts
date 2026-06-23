import type { Reward } from './reward'
import type { RewardType } from './reward'
import type { CharacterBuild } from './character-build'

// ════════════════════════════════════════
//  节点数据模型
// ════════════════════════════════════════

/** 节点内容类型 */
export type NodeContent = 'combat' | 'event'

/** 节点类型 */
export type NodeType = 'bg' | 'weapon' | 'normal' | 'boss'

/** 一个可选项（玩家从3个中选1） */
export interface NodeOption {
    content: NodeContent
    rewardType: RewardType
    desc: string
    /** combat 节点关联的对手 ID */
    enemyId?: string
    /** event 节点展示的文本 */
    eventText?: string
}

/** 地图节点 */
export interface MapNode {
    index: number // 1-33
    phase: 1 | 2 | 3
    type: NodeType
    /** normal 节点有3个选项 */
    options?: NodeOption[]
    /** boss 节点固定对手 */
    bossId?: string
    completed?: boolean
}

/** 选择结果 */
export interface ChoiceResult {
    battleResult?: 'win' | 'lose'
    enemyId?: string
    eventText?: string
    /** 非 cult 奖励时3个候选 */
    rewardChoices?: Reward[]
    /** cult 奖励时+4 */
    cultPoints?: number
}

/** 节点日志条目 */
export interface NodeLogEntry {
    nodeIndex: number
    nodeType: NodeType
    chosenOption?: NodeOption
    chosenReward?: Reward
    cultPointsGained?: number
    battleResult?: 'win' | 'lose'
    enemyId?: string
}

/** 运行状态（build 为唯一数据源） */
export interface RunState {
    map: MapNode[]
    currentNode: number
    build: CharacterBuild
    unspentCultPoints: number
    defeatedEnemies: string[]
    log: NodeLogEntry[]
    finished: boolean
}

/** JSON 存档格式 */
export interface SaveData {
    mode: 'quick' | 'normal'
    map: MapNode[]
    state: RunState
    nodeIdx: number
    enemyPool: string[]
    enemyIdx: number
}

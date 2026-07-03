import type { GameState } from './state'

// ════════════════════════════════════════
//  故事定义（新系统）
//  玩家在 node 1 选完背景后，故事将 overrides 和 insertions 叠加到地图上。
// ════════════════════════════════════════

/** 在某个范围内随机插入一个事件。 */
export interface EventInsertion {
    eventId: string
    /** 插入范围 [min, max]（1-based，含两端）。叠加时随机选一个位置。 */
    range: [number, number]
}

/** 故事定义 */
export interface StoryDef {
    id: string
    name: string
    characterName: string
    description: string
    /** { 节点编号: 事件ID }。覆盖该节点的 eventIds 为该事件。 */
    overrides: Record<number, string>
    /** 随机插入列表。叠加时一次性定死。 */
    insertions: EventInsertion[]
    /** 进入每个节点时调用。故事可以在此修改 GameState（如 sect 每 4 节点加修炼点）。 */
    onNode?: (state: GameState, nodeIndex: number) => void
}

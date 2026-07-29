import type { CharacterBuild } from './character-build'
import type { Node } from './node'
import type { Round } from './round'
import type { TournamentData } from './tournament'

/** 引擎状态快照。每次 selectChoice 后引擎生成新快照并通过 subscribe 推送。外部只读。 */
export interface GameState {
    /** 当前节点编号。1-based，1-33。>33 时 finished=true。 */
    nodeIndex: number

    /** 当前事件在 eventDef.rounds 中的索引。引擎内部使用。 */
    roundIdx: number

    /** 完整地图 33 个节点。叠加后锁定。 */
    nodes: Node[]

    /** 当前节点的所有轮次。推进到下一节点时清空，重新累计。 */
    rounds: Round[]

    /** 角色数据。复用 CharacterBuild。 */
    build: CharacterBuild

    /** 未分配的修炼点。 */
    unspentPoints: number

    /** 伤势 0-100。>=100 时 finished=true。 */
    injury: number

    /** 运行时旗标。由 Choice.setFlags 设置，故事线也可写入字符串值。 */
    flags: Record<string, boolean | string>

    /** 已完成节点的简要日志。示例：["玄门→飞剑", "战斗→胜利 45/100"] */
    nodeLog: string[]

    /** 斗炁大会赛程数据。有值→处于斗炁大会阶段。 */
    tournamentData?: TournamentData

    /** 奖励预算：已给的修炼点次数。用于动态调概率，保证约 16/32。 */
    rewardBudget: { pointsGiven: number }

    /** 是否已结束。 */
    finished: boolean
}

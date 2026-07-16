export type { GameState } from '../../game/entities/state'

import type { GameState } from '../../game/entities/state'

/** 引擎接口。输入输出分离：subscribe 接收状态变更，selectChoice 发起操作。 */
export interface RogueliteEngine {
    /** 订阅状态变更。每次 selectChoice 后推送最新 GameState。返回取消订阅函数。 */
    subscribe(listener: (state: GameState) => void): () => void

    /** 玩家做出选择。@param choiceIndex - 当前最新一轮的第几个选项（0-based）。 */
    selectChoice(choiceIndex: number): void

    /** 获取当前状态快照。 */
    getState(): GameState
}

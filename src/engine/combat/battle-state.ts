import type { Character } from '../entities/character'
import type { PositionSystem } from './position'
import type { TurnManager } from './turn'
import type { BattleLog } from './battle-log'
import type { BuffLayer, BattlePhase } from './types'
import { BuffRegistry } from './utils/buff-registry'
import type { RegisteredHook } from './utils/buff-registry'

/**
 * 战斗状态：由纯 interface 升级为 class，buff 存取/遍历收口到 BuffRegistry。
 *
 * 兼容性：
 *  - 字段与旧 interface 同名同义（phase/characters/position/turn/log…），`state.xxx` 读写不变
 *  - `state.pendingBuffs` 现在是 BuffRegistry（继承 Map）：`.set/.delete/.get/.has/.entries` 全部可用，
 *    且 set/delete 自动维护 byOwner 索引与 hook 注册表
 *  - `cloneFor(ids)`：AI 评估沙盒克隆（只带目标角色层及其 hook 注册）
 *  - snapshot 输出：`toSnapshotEntries()` 等价旧 `[...pendingBuffs.entries()]`
 */
export class BattleState {
    phase: BattlePhase = 'idle'
    characters: [Character, Character] = null as unknown as [Character, Character]
    position: PositionSystem = null as unknown as PositionSystem
    turn: TurnManager = null as unknown as TurnManager
    log: BattleLog = null as unknown as BattleLog
    eventActorId: string | null = null
    eventTime = 0
    /** buff 注册表（原 pendingBuffs：Map<string, BuffLayer>） */
    pendingBuffs: BuffRegistry = new BuffRegistry()
    lastWinner?: string
    actionCount = 0
    isEmitting = false
    moveDelta = 0
    triggeredThisChain: Set<string> | null = null

    /** AI 评估沙盒：克隆只含指定角色层的新 state（钩子读写克隆不污染真源） */
    cloneFor(charIds: readonly string[]): BattleState {
        const s = new BattleState()
        s.phase = this.phase
        s.characters = this.characters
        s.position = this.position
        s.turn = this.turn
        s.log = this.log
        s.eventActorId = this.eventActorId
        s.eventTime = this.eventTime
        s.pendingBuffs = this.pendingBuffs.cloneFor(charIds)
        s.lastWinner = this.lastWinner
        s.actionCount = this.actionCount
        s.isEmitting = this.isEmitting
        s.moveDelta = this.moveDelta
        s.triggeredThisChain = this.triggeredThisChain
        return s
    }

    /** 受限版 cloneFor：buff 只克隆「指定角色且 def 命中 hooks 白名单」的层，其余状态照 cloneFor 处理 */
    cloneForHooks(charIds: readonly string[], hooks: readonly RegisteredHook[]): BattleState {
        const s = new BattleState()
        s.phase = this.phase
        s.characters = this.characters
        s.position = this.position
        s.turn = this.turn
        s.log = this.log
        s.eventActorId = this.eventActorId
        s.eventTime = this.eventTime
        s.pendingBuffs = this.pendingBuffs.cloneForHooks(charIds, hooks)
        s.lastWinner = this.lastWinner
        s.actionCount = this.actionCount
        s.isEmitting = this.isEmitting
        s.moveDelta = this.moveDelta
        s.triggeredThisChain = this.triggeredThisChain
        return s
    }

    /** 快照输出：等价旧 `[...pendingBuffs.entries()]` */
    toSnapshotEntries(): [string, BuffLayer][] {
        return [...this.pendingBuffs.entries()]
    }
}

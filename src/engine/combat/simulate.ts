import { Character } from '../entities/character'
import { BattleEngine, handleSystemEvent } from './engine'
import { SYS_PREFIX } from './turn'
import { planEvent } from '../ai'

/** 执行 AI 规划的一串指令 */
function executePlan(engine: BattleEngine, self: Character, cmds: import('./engine').ActionCommand[]) {
    for (const cmd of cmds) {
        if (self.ap <= 0 && cmd.type !== 'bonus') break
        engine.execute(cmd)
    }
}

/** 一场行动序列的完整模拟 */
export function simulateFight(
    player: Character,
    opponent: Character,
    playerActionId = 'straight_punch',
    opponentActionId?: string,
): { winner: string; engine: BattleEngine } {
    const engine = new BattleEngine(player, opponent)
    const { state } = engine

    while (state.phase === 'fighting') {
        if (!engine.startEvent()) break
        // 系统事件（buff 到期等）→ 特殊处理，不经过 doEvent
        if (state.eventActorId?.startsWith(SYS_PREFIX)) {
            const sysId = state.eventActorId.slice(SYS_PREFIX.length)
            handleSystemEvent(engine, sysId)
            state.turn.next()
            state.eventActorId = null
            continue
        }
        const isPlayer = state.eventActorId === player.id
        const self = isPlayer ? player : opponent
        const aid = isPlayer ? playerActionId : (opponentActionId ?? undefined)
        const cmds = planEvent(self, state, aid)
        executePlan(engine, self, cmds)
        engine.endEvent()
    }
    return { winner: player.isAlive() ? player.name : opponent.name, engine }
}

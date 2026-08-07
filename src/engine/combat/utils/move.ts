import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'

/** 执行位移并记录日志 */
export function executeMove(
    char: Character,
    engine: BattleEngine,
    delta: number,
    apCost = 0,
    opts?: {
        durationMs?: number
        blink?: boolean
        kind?: 'move' | 'short_dash' | 'dash'
        /** 位移招式名（如虎跃）：纯位移 support 走 move 日志时携带 */
        actionName?: string
    },
): void {
    const p = engine.state.position
    const opponent = engine.getOpponent(char.id)!
    // delta < 0 → moveToward (closer), delta > 0 → moveToward with positive (farther)
    // But the callers pass -delta for dash (e.g. executeMove(self, engine, -delta))
    // So the semantics are already: executeMove(self, engine, -3) means move 3 closer
    const actualDelta = p.moveToward(char.id, opponent.id, delta)
    engine.emitLog({
        type: 'move',
        sourceId: char.id,
        delta: actualDelta,
        newDistance: p.distance(char.id, opponent.id),
        apCost,
        apRemaining: char.ap,
        durationMs: opts?.durationMs,
        blink: opts?.blink,
        kind: opts?.kind,
        actionName: opts?.actionName,
    })
}

import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'

/**
 * 位移改变与对手距离时统一 emit 移动触发事件（与主移动一致）。
 * dash / short_dash / 击退 等位移也会触发 on_move_away / on_opponent_move_away 等事件。
 */
export function emitMoveEvents(engine: BattleEngine, char: Character, opponent: Character, actualDelta: number): void {
    if (actualDelta < 0) {
        engine.emit('on_move_closer', char, opponent)
        engine.state.moveDelta = actualDelta
        engine.emit('on_opponent_move_closer', opponent, char)
        engine.state.moveDelta = 0
    } else if (actualDelta > 0) {
        engine.emit('on_move_away', char, opponent)
        engine.state.moveDelta = actualDelta
        engine.emit('on_opponent_move_away', opponent, char)
        engine.state.moveDelta = 0
    }
}

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
    emitMoveEvents(engine, char, opponent, actualDelta)
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

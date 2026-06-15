import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'

/** 执行位移并记录日志 */
export function executeMove(char: Character, engine: BattleEngine, delta: number, apCost = 0): void {
    engine.state.distance.move(delta)
    engine.emitLog({
        type: 'move',
        sourceId: char.id,
        delta,
        newDistance: engine.state.distance.current,
        apCost,
        apRemaining: char.ap,
    })
}

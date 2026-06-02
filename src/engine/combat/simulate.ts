import { Character } from '../entities/character'
import { BattleEngine } from './engine'
import { WEAPONS } from '../calc/damage'
import { getAction } from '../data/actions'

/** 用招式ID模拟战斗 */
export function simulateFight(player: Character, opponent: Character, actionId = 'straight_punch'): { winner: string; engine: BattleEngine } {
    const engine = new BattleEngine(player, opponent)
    const { state } = engine
    const action = getAction(actionId)
    if (!action) throw new Error(`Unknown action: ${actionId}`)

    while (state.phase === 'fighting') {
        const actor = state.turn.peek()
        if (!actor) break

        const stats = WEAPONS[action.weaponType]
        if (state.distance.inRange(stats.range[0], stats.range[1])) {
            engine.execute({ type: 'attack', actionId, weaponType: action.weaponType })
        } else {
            engine.execute({ type: 'move', weaponType: action.weaponType, bestDistance: state.distance.current > stats.range[1] ? -1 : 1 })
        }
    }

    return { winner: player.isAlive() ? player.name : opponent.name, engine }
}

import { Character } from '../entities/character'
import { BattleEngine } from './engine'
import type { WeaponType } from '../calc/damage'
import { WEAPONS } from '../calc/damage'

/** 简单 AI 模拟战斗（双方都用拳头互殴） */
export function simulateFistFight(player: Character, opponent: Character): { winner: string; engine: BattleEngine } {
    const engine = new BattleEngine(player, opponent)
    const { state } = engine

    while (state.phase === 'fighting') {
        const actor = state.turn.peek()
        if (!actor) break

        const weapon: WeaponType = 'fist'
        const stats = WEAPONS[weapon]

        if (state.distance.inRange(stats.range[0], stats.range[1])) {
            engine.execute({ type: 'attack', weaponType: weapon, bestDistance: 1 })
        } else {
            const dir = state.distance.current > stats.range[1] ? -1 : 1
            engine.execute({ type: 'move', bestDistance: dir })
        }
    }

    return { winner: player.isAlive() ? player.name : opponent.name, engine }
}

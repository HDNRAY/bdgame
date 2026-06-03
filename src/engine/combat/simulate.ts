import { Character } from '../entities/character'
import { BattleEngine } from './engine'
import { WEAPONS } from '../calc/damage'
import { getAction } from '../data/actions'
import type { ActionDefinition } from '../entities/action'

function doEvent(engine: BattleEngine, self: Character, action: ActionDefinition) {
  const { state } = engine
  const stats = WEAPONS[action.weaponType]
  let acted = false
  while (state.phase === 'fighting') {
    if (state.distance.inRange(stats.range[0], stats.range[1])) {
      if (self.ap < action.apCost) break
      engine.execute({ type: 'attack', actionId: action.id, weaponType: action.weaponType })
      acted = true
    } else {
      if (self.ap <= 0) break
      const dir = state.distance.current > stats.range[1] ? -1 : 1
      engine.execute({ type: 'move', weaponType: action.weaponType, bestDistance: dir })
      acted = true
    }
    if (state.phase !== 'fighting') break
  }
  return acted
}

export function simulateFight(
  player: Character, opponent: Character,
  playerActionId = 'straight_punch', opponentActionId?: string
): { winner: string; engine: BattleEngine } {
  const engine = new BattleEngine(player, opponent)
  const { state } = engine
  const pAction = getAction(playerActionId)
  const oAction = getAction(opponentActionId ?? playerActionId)
  if (!pAction || !oAction) throw new Error('Unknown action')

  while (state.phase === 'fighting') {
    if (!engine.startEvent()) break
    const isPlayer = state.eventActorId === player.id
    const self = isPlayer ? player : opponent
    const action = isPlayer ? pAction : oAction
    if (!doEvent(engine, self, action)) break
    engine.endEvent()
  }
  return { winner: player.isAlive() ? player.name : opponent.name, engine }
}

import { Character } from '../entities/character'
import { BattleEngine, tryBonus } from './engine'
import { WEAPONS } from '../calc/damage'
import type { ActionInstance } from '../entities/action-instance'

function doEvent(engine: BattleEngine, self: Character, action: ActionInstance) {
  const { state } = engine
  const stats = WEAPONS[action.def.weaponType]
  let usedMain = false

  while (state.phase === 'fighting') {
    if (!usedMain && state.distance.inRange(stats.range[0], stats.range[1])) {
      if (self.ap < action.apCost) break
      tryBonus(engine, self, 'before_main', action.apCost)
      if (self.ap < action.apCost) break
      engine.execute({ type: 'attack', actionId: action.id, weaponType: action.def.weaponType })
      usedMain = true
      tryBonus(engine, self, 'after_main')
      continue
    }
    const dist = state.distance.current
    if (dist > stats.range[1]) { if (self.ap <= 0) break; engine.execute({ type: 'move', weaponType: action.def.weaponType, bestDistance: -1 }); continue }
    if (dist < stats.range[0]) { if (self.ap <= 0) break; engine.execute({ type: 'move', weaponType: action.def.weaponType, bestDistance: 1 }); continue }
    break
  }
}

export function simulateFight(
  player: Character, opponent: Character,
  playerActionId = 'straight_punch', opponentActionId?: string,
): { winner: string; engine: BattleEngine } {
  const engine = new BattleEngine(player, opponent)
  const { state } = engine

  while (state.phase === 'fighting') {
    if (!engine.startEvent()) break
    const isPlayer = state.eventActorId === player.id
    const self = isPlayer ? player : opponent
    const aid = isPlayer ? playerActionId : (opponentActionId ?? playerActionId)
    const inst = self.actionInstances.find(a => a.id === aid)
    if (!inst || !inst.canUse()) break
    doEvent(engine, self, inst)
    engine.endEvent()
  }
  return { winner: player.isAlive() ? player.name : opponent.name, engine }
}

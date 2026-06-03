import { Character } from '../entities/character'
import { BattleEngine } from './engine'
import { WEAPONS } from '../calc/damage'
import { getAction } from '../data/actions'
import type { ActionDefinition } from '../entities/action'

/** 简单 AI：一个 event 最多 1 个主招 + 移动控距 */
function doEvent(engine: BattleEngine, self: Character, action: ActionDefinition, isPlayer: boolean) {
  const { state } = engine
  const stats = WEAPONS[action.weaponType]
  let usedMain = false

  while (state.phase === 'fighting') {
    const dist = state.distance.current

    // 还没攻击且在范围内 → 攻击（只一次）
    if (!usedMain && state.distance.inRange(stats.range[0], stats.range[1])) {
      if (self.ap < action.apCost) break
      engine.execute({ type: 'attack', actionId: action.id, weaponType: action.weaponType })
      usedMain = true
      continue
    }

    // 枪/远程 AI：被贴脸（≤2）时后退
    if (!isPlayer && stats.range[0] >= 2 && dist <= 2) {
      if (self.ap <= 0) break
      engine.execute({ type: 'move', weaponType: action.weaponType, bestDistance: 1 })
      continue
    }

    // 拳/近战 AI：在范围外时靠近
    if (dist > stats.range[1]) {
      if (self.ap <= 0) break
      engine.execute({ type: 'move', weaponType: action.weaponType, bestDistance: -1 })
      continue
    }

    // 已攻击且距离合适 → 结束
    break
  }
}

export function simulateFight(
  player: Character, opponent: Character,
  playerActionId = 'straight_punch', opponentActionId?: string,
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
    doEvent(engine, self, action, isPlayer)
    engine.endEvent()
  }
  return { winner: player.isAlive() ? player.name : opponent.name, engine }
}

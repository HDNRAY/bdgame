import { Character } from '../entities/character'
import { BattleEngine } from './engine'
import { WEAPONS } from '../calc/damage'
import { getAction } from '../data/actions'
import type { ActionDefinition } from '../entities/action'

/** 检查并执行辅招 */
function tryBonus(engine: BattleEngine, self: Character, mainAp: number): boolean {
  if (!self.actions.includes('power_double')) return false
  if (self.ap < 2 + mainAp) return false
  // 只触发一次（从列表移除）
  self.actions = self.actions.filter(a => a !== 'power_double')
  self.spendAp(2)
  const original = self.attrs.get('strength')
  self.attrs.set('strength', original * 2)
  engine.state.log.logSystem(`[蓄力] ${self.name} 力量 ${original}→${original * 2}!`, engine.state.turn.peek()?.nextActionAt ?? 0)
  return true
}

/** 简单 AI：移动→辅招→主招 */
function doEvent(engine: BattleEngine, self: Character, action: ActionDefinition) {
    const { state } = engine
    const stats = WEAPONS[action.weaponType]
    let usedMain = false

    while (state.phase === 'fighting') {
        const dist = state.distance.current

// 在范围内且没打过 → 先试辅招，再主招
    if (!usedMain && state.distance.inRange(stats.range[0], stats.range[1])) {
      if (self.ap < action.apCost) break
      tryBonus(engine, self, action.apCost)
            if (self.ap < action.apCost) break
            engine.execute({ type: 'attack', actionId: action.id, weaponType: action.weaponType })
            usedMain = true
            continue
        }

        // 超出武器范围 → 朝目标方向移动
        if (dist > stats.range[1]) {
            if (self.ap <= 0) break
            engine.execute({ type: 'move', weaponType: action.weaponType, bestDistance: -1 })
            continue
        }
        if (dist < stats.range[0]) {
            if (self.ap <= 0) break
            engine.execute({ type: 'move', weaponType: action.weaponType, bestDistance: 1 })
            continue
        }

        // 已攻击且距离合适 → 结束
        break
    }
}

export function simulateFight(
    player: Character,
    opponent: Character,
    playerActionId = 'straight_punch',
    opponentActionId?: string,
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
        doEvent(engine, self, action)
        engine.endEvent()
    }
    return { winner: player.isAlive() ? player.name : opponent.name, engine }
}

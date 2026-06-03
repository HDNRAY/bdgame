import { Character } from '../entities/character'
import { BattleEngine } from './engine'
import { WEAPONS } from '../calc/damage'
import { getAction } from '../data/actions'
import type { ActionDefinition } from '../entities/action'
import type { AttrName } from '../entities/attributes'

/** 通用辅招检查：遍历角色所有辅招，满足条件则执行 */
function tryBonus(engine: BattleEngine, self: Character, mainAp: number): boolean {
    let fired = false
    const toRemove: string[] = []
    for (const aid of self.actions) {
        const bonus = getAction(aid)
        if (!bonus?.bonus) continue
        if (bonus.bonusTiming !== 'before_main') continue
        // 条件：剩余 AP 够同时支付辅招和主招
        if (self.ap < bonus.apCost + mainAp) continue
        // 执行
        self.spendAp(bonus.apCost)
        toRemove.push(aid)
        const effect = bonus.triggerEffect
        if (effect?.type === 'stat_multiply') {
            const attr = effect.stat as AttrName
            const old = self.attrs.get(attr)
            self.attrs.set(attr, old * effect.multiplier)
            engine.state.log.logSystem(
                `[${bonus.name}] ${self.name} ${effect.stat} ${old}→${old * effect.multiplier}!`,
                engine.state.turn.peek()?.nextActionAt ?? 0,
            )
        }
        fired = true
    }
    // 已触发的辅招从列表移除（一局一次）
    self.actions = self.actions.filter((a) => !toRemove.includes(a))
    return fired
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

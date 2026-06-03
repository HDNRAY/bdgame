import { Character } from '../entities/character'
import { BattleEngine, tryBonus, handleSystemEvent } from './engine'
import { DistanceSystem } from './distance'
import { SYS_PREFIX } from './turn'
import { WEAPONS } from '../calc/damage'
import type { ActionInstance } from '../entities/action-instance'

function doEvent(engine: BattleEngine, self: Character, action: ActionInstance) {
    const { state } = engine
    const stats = WEAPONS[action.def.weaponType]
    // 辅招（凝炁/聚炁）在移动前释放
    tryBonus(engine, self, 'before_main', action.apCost)
    let usedMain = false

    while (state.phase === 'fighting') {
        if (!usedMain && state.distance.inRange(stats.range[0], stats.range[1])) {
            if (self.ap < action.apCost) break
            engine.execute({ type: 'attack', actionId: action.id, weaponType: action.def.weaponType })
            usedMain = true
            tryBonus(engine, self, 'after_main')
            continue
        }
        const dist = state.distance.current
        if (dist > stats.range[1]) {
            const need = dist - stats.range[1]
            const perAp = DistanceSystem.apToRange(self.attrs.get('dexterity'))
            const apNeeded = Math.ceil(need / perAp)
            if (self.ap < apNeeded) break
            engine.execute({ type: 'move', weaponType: action.def.weaponType, bestDistance: -apNeeded })
            continue
        }
        if (dist < stats.range[0]) {
            const need = stats.range[0] - dist
            const perAp = DistanceSystem.apToRange(self.attrs.get('dexterity'))
            const apNeeded = Math.ceil(need / perAp)
            if (self.ap < apNeeded) break
            engine.execute({ type: 'move', weaponType: action.def.weaponType, bestDistance: apNeeded })
            continue
        }
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

    while (state.phase === 'fighting') {
        if (!engine.startEvent()) break
        // 系统事件（buff 到期等）→ 特殊处理，不经过 doEvent
        if (state.eventActorId?.startsWith(SYS_PREFIX)) {
            const sysId = state.eventActorId.slice(SYS_PREFIX.length)
            handleSystemEvent(engine, sysId)
            // 系统事件不调用 endEvent（不消耗 AP / 不入队）
            state.turn.next()
            state.eventActorId = null
            continue
        }
        const isPlayer = state.eventActorId === player.id
        const self = isPlayer ? player : opponent
        const aid = isPlayer ? playerActionId : (opponentActionId ?? playerActionId)
        const inst = self.actionInstances.find((a) => a.id === aid)
        if (!inst || !inst.canUse()) break
        doEvent(engine, self, inst)
        engine.endEvent()
    }
    return { winner: player.isAlive() ? player.name : opponent.name, engine }
}

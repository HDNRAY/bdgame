import type { Character } from '../entities/character'
import type { BattleState, ActionCommand } from '../combat/engine'
import { WEAPONS } from '../calc/damage'
import { DistanceSystem } from '../combat/distance'

/** AI 决策：返回本行动中要执行的一串指令 */
export function planEvent(self: Character, state: BattleState, preferredMainId?: string): ActionCommand[] {
    const cmds: ActionCommand[] = []

    // 1. 决定主招
    const mainId = preferredMainId ?? pickMainAction(self, state)
    if (!mainId) return cmds
    const mainDef = self.actionInstances.find((a) => a.id === mainId)?.def
    if (!mainDef) return cmds
    const stats = WEAPONS[mainDef.weaponType]

    // 2. 计算移动需要多少 AP
    const perAp = DistanceSystem.apToRange(self.attrs.get('dexterity'))
    let moveAp = 0
    let virtualDist = state.distance.current
    if (virtualDist > stats.range[1]) {
        const need = virtualDist - stats.range[1]
        moveAp = Math.ceil(need / perAp)
        virtualDist -= perAp * moveAp
    } else if (virtualDist < stats.range[0]) {
        const need = stats.range[0] - virtualDist
        moveAp = Math.ceil(need / perAp)
        virtualDist += perAp * moveAp
    }

    const apAfterMove = self.ap - moveAp

    // 3. 辅招（凝炁/聚炁）— 只有移动后 AP 够主招+辅招才放
    let bonusAp = 0
    for (const inst of self.actionInstances) {
        if (!inst.def.bonus) continue
        if (!inst.canUse()) continue
        if (inst.def.bonusTiming?.type !== 'before_main') continue
        // 检查移动后 AP 够走完所有已选辅招 + 当前辅招 + 主招
        if (apAfterMove < bonusAp + inst.apCost + mainDef.apCost) continue
        cmds.push({ type: 'bonus', actionId: inst.id })
        bonusAp += inst.apCost
    }

    // 4. 移动
    if (moveAp > 0) {
        cmds.push({ type: 'move', bestDistance: state.distance.current > stats.range[1] ? -moveAp : moveAp })
    }

    // 5. 攻击
    if (apAfterMove - bonusAp >= mainDef.apCost && virtualDist >= stats.range[0] && virtualDist <= stats.range[1]) {
        cmds.push({ type: 'attack', actionId: mainId, weaponType: mainDef.weaponType })
    }

    return cmds
}

/** 选第一个能放的主招 */
function pickMainAction(self: Character, state: BattleState): string | null {
    for (const inst of self.actionInstances) {
        if (inst.def.bonus) continue
        if (!inst.canUse()) continue
        if (self.ap < inst.apCost) continue
        const stats = WEAPONS[inst.def.weaponType]
        if (!state.distance.inRange(stats.range[0], stats.range[1]) && self.ap <= inst.apCost) continue
        return inst.id
    }
    return null
}

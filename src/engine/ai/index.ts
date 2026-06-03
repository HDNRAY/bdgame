import type { Character } from '../entities/character'
import type { BattleState, ActionCommand } from '../combat/engine'
import { WEAPONS } from '../calc/damage'
import { DistanceSystem } from '../combat/distance'

/** AI 决策：返回本行动中要执行的一串指令 */
export function planEvent(self: Character, state: BattleState, preferredMainId?: string): ActionCommand[] {
    const cmds: ActionCommand[] = []

    // 1. 决定主招
    const mainId = preferredMainId ?? pickMainAction(self, state)
    if (!mainId) return cmds  // 没招可用
    const mainDef = self.actionInstances.find(a => a.id === mainId)?.def
    if (!mainDef) return cmds
    const stats = WEAPONS[mainDef.weaponType]

    // 2. 辅招（凝炁/聚炁等）— 选 AP 够的放
    for (const inst of self.actionInstances) {
        if (!inst.def.bonus) continue
        if (!inst.canUse()) continue
        if (inst.def.bonusTiming !== 'before_main') continue
        if (self.ap < inst.apCost + mainDef.apCost) continue
        cmds.push({ type: 'bonus', actionId: inst.id })
    }

    // 3. 移动：如果不在武器范围内，走到范围边缘
    const dist = state.distance.current
    if (dist > stats.range[1]) {
        const need = dist - stats.range[1]
        const perAp = DistanceSystem.apToRange(self.attrs.get('dexterity'))
        const apNeeded = Math.ceil(need / perAp)
        if (self.ap >= apNeeded) {
            cmds.push({ type: 'move', bestDistance: -apNeeded })
        }
    } else if (dist < stats.range[0]) {
        const need = stats.range[0] - dist
        const perAp = DistanceSystem.apToRange(self.attrs.get('dexterity'))
        const apNeeded = Math.ceil(need / perAp)
        if (self.ap >= apNeeded) {
            cmds.push({ type: 'move', bestDistance: apNeeded })
        }
    }

    // 4. 攻击
    if (self.ap >= mainDef.apCost && state.distance.inRange(stats.range[0], stats.range[1])) {
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


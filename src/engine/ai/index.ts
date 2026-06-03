import type { Character } from '../entities/character'
import type { BattleState } from '../combat/engine'
import { WEAPONS } from '../calc/damage'

/** AI 决策结果 */
export interface AiDecision {
    actionId: string
}

/** 简单 AI：选择第一个能放得出来的招式 */
export function pickAction(self: Character, state: BattleState): AiDecision {
    for (const inst of self.actionInstances) {
        if (!inst.canUse()) continue
        const action = inst.def
        if (action.bonus) continue
        if (self.ap < action.apCost) continue
        const stats = WEAPONS[action.weaponType]
        if (!state.distance.inRange(stats.range[0], stats.range[1])) continue
        return { actionId: action.id }
    }
    return { actionId: '' }
}

import type { ActionDefinition } from '../../entities/action'
import type { Character } from '../../entities/character'
import type { BattleState } from '../types'
import { round1 } from '../../util/math'
import { forEachHookOf } from './buff-loop'

/**
 * 招式实际缠劲消耗 = `action.chanCost + Σ onActionChanCost`（负=更省），每个 buff 各自 clamp 到 ≥0。
 *
 * 与 AP 的 `onActionCost` 同构，但**只有一个入口**：AP 那边散在 engine / action-executor / planner /
 * expected-damage 四处，各写一遍就漏了一处（`calcExpectedDamage` 长期不算 onActionCost，导致 AI 效率
 * 排序按虚高的 AP 算）；缠劲这边统一走这里，主招、前后摇辅助招、AI 估算、可行性检查全都吃同一份。
 *
 * `target` 只供钩子读取（绝大多数钩子不看它）；不传就用自己（辅助招多是自指）。
 */
export function calcActionChanCost(
    state: BattleState,
    self: Character,
    action: ActionDefinition,
    target?: Character,
): number {
    const base = action.chanCost ?? 0
    // 0 成本招式保持 0：不能因为折扣变成"倒赚缠劲"
    if (base <= 0) return base
    let cost = base
    forEachHookOf(state.pendingBuffs, 'onActionChanCost', self.id, (def, layer) => {
        const delta = def.onActionChanCost?.({
            final: 0,
            raw: 0,
            attacker: self,
            target: target ?? self,
    state,
    layer,
    source: action,
})
        if (delta) cost = Math.max(0, cost + delta)
    })
    return round1(cost)
}

import type { BattleState } from '../types'
import { forEachBuffOf } from './buff-loop'

/** 统计角色身上所有醉酒（jiu tag）buff 的层数：additive 按 restoreValue 计层，independent 每层计1 */
export function countDrunkLayers(state: BattleState, charId: string): number {
    let count = 0
    forEachBuffOf(state.pendingBuffs, charId, (def, layer) => {
        if (!def?.tags?.includes('jiu')) return
        count += def.stacking?.type === 'additive' ? (layer.restoreValue ?? 1) : 1
    })
    return count
}

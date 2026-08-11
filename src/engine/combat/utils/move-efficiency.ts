import type { Character } from '../../entities/character'
import type { BattleState } from '../types'
import { forEachBuffOf } from './buff-loop'

/** 该角色来自 buff 的额外移动效率（加算，0.1 = +10% 每AP移动距离） */
export function calcExtraMoveEfficiency(state: BattleState, char: Character): number {
    let extra = 0
    forEachBuffOf(state.pendingBuffs, char.id, (def, layer) => {
        const contrib = def?.onMoveEfficiency?.({
            final: 0,
            raw: 0,
            target: char,
            attacker: char,
            state,
            layer,
        })
        if (contrib) extra += contrib
    })
    return extra
}

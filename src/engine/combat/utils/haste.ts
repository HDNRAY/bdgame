import type { Character } from '../../entities/character'
import type { BattleState } from '../types'
import { forEachBuffOf } from './buff-loop'

/** 该角色来自 buff 的额外急速（加算，1 = +1 急速；AP 成本减免/行动前摇加速） */
export function calcExtraHaste(state: BattleState, char: Character): number {
    let extra = 0
    forEachBuffOf(state.pendingBuffs, char.id, (def, layer) => {
        const contrib = def?.onHaste?.({
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

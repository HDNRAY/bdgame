import type { Character } from '../../../engine/entities/character'
import type { BattleState } from '../../../engine/combat/types'
import { BattleState as BattleStateImpl } from '../../../engine/combat/battle-state'
import { BuffRegistry } from '../../../engine/combat/utils/buff-registry'
import type { BuffLayer } from '../../../engine/combat/types'

/**
 * DevMode 评估用最小 BattleState：构造真 BattleState class（含 cloneFor），
 * buff 用 BuffRegistry 承载，position/turn 用 mock 最小实现。
 * calcExpectedDamage 只读 position.distance / turn.currentTime / pendingBuffs，
 * 其余字段不参与评估，mock 即可。
 */
export function makeEvalState(
    atk: Character,
    def: Character,
    opts: { distance: number; currentTime?: number; buffs?: Map<string, BuffLayer> },
): BattleState {
    const st = new BattleStateImpl()
    st.characters = [atk, def]
    const registry = new BuffRegistry()
    if (opts.buffs) {
        for (const [k, v] of opts.buffs) registry.set(k, v)
    }
    st.pendingBuffs = registry
    st.position = {
        distance: () => opts.distance,
    } as unknown as BattleState['position']
    st.turn = {
        currentTime: opts.currentTime ?? 0,
    } as unknown as BattleState['turn']
    return st
}

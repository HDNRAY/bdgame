import type { Character } from '../../entities/character'
import type { BattleState } from '../types'
import { getBuff } from '../../../data/buffs'
import { forEachBuffOf } from './buff-loop'

/** 该 buff 是否影响缠劲回复（具备 chanRegenPerSec 钩子）——能力检查，不认 ID */
export function affectsChanRegen(buffId: string): boolean {
    return getBuff(buffId)?.chanRegenPerSec != null
}

/**
 * 该角色的有效缠劲回复速度（每秒）：各 buff 的 chanRegenPerSec 钩子贡献之和。
 * 由引擎统一 regen_tick 逐秒发放（独立叠层各层都计）。
 */
export function calcEffectiveChanRegenPerSec(state: BattleState, char: Character): number {
    let total = 0
    forEachBuffOf(state.pendingBuffs, char.id, (def, layer) => {
        const contrib = def?.chanRegenPerSec?.({
            final: 0,
            raw: 0,
            target: char,
            attacker: char,
            state,
            layer,
        })
        if (contrib) total += contrib
    })
    return total
}

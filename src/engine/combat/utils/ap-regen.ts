import type { Character } from '../../entities/character'
import type { BattleState } from '../types'
import { calcApRegenPerSec } from '../../calc/damage'
import { getBuff } from '../../../data/buffs'

/** 该 buff 是否影响 AP 回复（具备 apRegenPerSec 钩子）——能力检查，不认 ID */
export function affectsApRegen(buffId: string): boolean {
    return getBuff(buffId)?.apRegenPerSec != null
}

/**
 * 该角色的有效 AP 回复速度（每秒）：
 * 基础(推演) + 各 buff 的 apRegenPerSec 钩子贡献
 */
export function calcEffectiveApRegenPerSec(state: BattleState, char: Character): number {
    const base = calcApRegenPerSec(char.attrs.get('wisdom'))
    let extra = 0
    for (const [key, layer] of state.pendingBuffs) {
        const [buffId, charId] = key.split('::')
        if (charId !== char.id) continue
        const def = getBuff(buffId)
        const contrib = def?.apRegenPerSec?.({
            final: 0,
            raw: 0,
            target: char,
            attacker: char,
            state,
            layer,
        })
        if (contrib) extra += contrib
    }
    return base + extra
}

/**
 * AP 回复率变化 → 重算该角色 pending 的下次行动时间。
 * 触发：wis 属性变化、获得/失去带 apRegenPerSec 钩子的 buff（九阳→内息澎湃、肾上腺素、不老泉）
 */
export function notifyRegenChanged(state: BattleState, char: Character): void {
    state.turn.recalcRegenDelay(char.id, calcEffectiveApRegenPerSec(state, char), char.ap, char.maxAp)
}

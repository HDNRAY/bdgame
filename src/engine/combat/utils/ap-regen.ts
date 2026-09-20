import type { Character } from '../../entities/character'
import type { BattleState } from '../types'
import { calcApRegenPerSec } from '../../calc/damage'
import { getBuff } from '../../../data/buffs'
import { forEachHookOf } from './buff-loop'

/** 该 buff 是否影响 AP 回复（具备 apRegenPerSec 钩子）——能力检查，不认 ID */
export function affectsApRegen(buffId: string): boolean {
    return getBuff(buffId)?.apRegenPerSec != null
}

/** 该角色来自 buff 的额外 AP 回复速度（每秒，可正可负） */
export function calcExtraApRegenPerSec(state: BattleState, char: Character): number {
    let extra = 0
    forEachHookOf(state.pendingBuffs, 'apRegenPerSec', char.id, (def, layer) => {
        const contrib = def.apRegenPerSec?.({
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

/**
 * 该角色的有效 AP 回复速度（每秒）：
 * 基础(推演) + 各 buff 的 apRegenPerSec 钩子贡献。
 *
 * 净回复恒为正：`turn.recalcRegenDelay` 用 `max(0.001, regenPerSec)` 兜底，回复速度 ≤0 等于把该角色
 * 永久冻住（再也排不到行动），所以减回复类 debuff（断炁/紊乱/御物耗炁…）叠起来最多压到基础的 25%。
 */
export function calcEffectiveApRegenPerSec(state: BattleState, char: Character): number {
    const base = calcApRegenPerSec(char.attrs.get('wisdom'))
    return Math.max(base * 0.25, base + calcExtraApRegenPerSec(state, char))
}

/**
 * AP 回复率变化 → 重算该角色 pending 的下次行动时间。
 * 触发：wis 属性变化、获得/失去带 apRegenPerSec 钩子的 buff（九阳→内息澎湃、肾上腺素、不老泉）
 */
export function notifyRegenChanged(state: BattleState, char: Character): void {
    state.turn.recalcRegenDelay(char, calcEffectiveApRegenPerSec(state, char))
}

import type { Character } from '../../entities/character'
import type { BattleState } from '../types'
import type { ActionDefinition } from '../../entities/action'
import type { BattleEngine } from '../engine'
import { calcCritChance } from '../../calc/damage'
import { forEachHookOf } from './buff-loop'

/**
 * 实时暴击率（与 `resolveCrit` 同口径，唯一真源）：
 *   基础(灵巧/洞察) + 攻方 `onCritChance` 加算 + 守方 `onCritTakenChance` 加算 + 招式自带 `onActionCritChance`。
 *
 * 给「按暴击率触发概率」的附加效果用（铸火诀追加灼烧、焰炁、毒药大师施毒）——这类效果必须读
 * **当时**的暴击率；直接用 `calcCritChance(dexterity, insight)` 会漏掉暴击 buff 与招式自身加成
 * （曾有实现漏传 `source`，导致依赖招式 tag 的暴击 buff 恒为 0）。
 *
 * 口径细节与 `resolveCrit` 保持一致：没传 `action` 时攻方 `onCritChance` 不生效（与引擎"无招不判"一致），
 * 守方 `onCritTakenChance` 与招式自带加成照常生效。
 */
export function calcEffectiveCritChance(
    state: BattleState,
    attacker: Character,
    target: Character,
    action?: ActionDefinition,
    opts?: { damage?: number; raw?: number; triggered?: boolean; engine?: BattleEngine },
): number {
    const damage = opts?.damage ?? 0
    const raw = opts?.raw ?? damage
    const triggered = opts?.triggered ?? false
    let bonus = 0
    forEachHookOf(state.pendingBuffs, 'onCritChance', attacker.id, (def, layer) => {
        if (!action || !def.onCritChance) return
        bonus +=
            def.onCritChance({
                final: damage,
                raw,
                target,
                attacker,
                engine: opts?.engine,
                state,
                layer,
                source: action,
                triggered,
            }) ?? 0
    })
    forEachHookOf(state.pendingBuffs, 'onCritTakenChance', target.id, (def, layer) => {
        if (!def.onCritTakenChance) return
        bonus +=
            def.onCritTakenChance({
                final: damage,
                raw,
                target,
                attacker,
                engine: opts?.engine,
                state,
                layer,
                source: action,
            }) ?? 0
    })
    let crit = calcCritChance(attacker.attrs.get('dexterity'), attacker.attrs.get('insight'), bonus)
    if (action?.onActionCritChance) crit = action.onActionCritChance(crit, state, attacker)
    return crit
}

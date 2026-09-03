import type { ActionDefinition } from '../entities/action'
import type { Character } from '../entities/character'
import type { BattleState, BuffLayer } from '../combat/types'
import { getActionRange, getRuntimeAction } from '../../data/actions'
import { forEachBuffOf } from '../combat/utils'
import { BattleEngine } from '../combat/engine'

/** 检查招式是否满足释放条件 */
export function canExecuteAction(
    action: ActionDefinition,
    attacker: Character,
    state: BattleState,
    _engine?: BattleEngine,
): { ok: boolean; reason?: string } {
    // AP 成本与 #executeAction 扣费同口径：遍历攻击方 onActionCost 打折后，再走身法/急速减免。
    // onActionCost 可能带副作用（分心错手写 layer.extra.firstActionDone 标记「已出手」）——
    // 验证只是检查，不应推进真实标记：给每个 layer 浅克隆（extra 也克隆），钩子写克隆不影响真源；
    // 读 firstActionDone 拿到的是克隆自真实的当前值 → 分心错手对「是否第二招」判断正确。
    // 0 成本招式（御物召唤等）天然免费：calcActionCostAfterSpeed 对 0 成本返回 0，不校验 AP。
    let cost = action.apCost
    if (action.apCost > 0) {
        forEachBuffOf(state.pendingBuffs, attacker.id, (def, layer) => {
            if (!def?.onActionCost) return
            const clone: BuffLayer = { ...layer, extra: layer.extra ? { ...layer.extra } : undefined }
            const r = def.onActionCost({
                final: 0,
                raw: 0,
                attacker,
                target: state.characters.find((c) => c.id !== attacker.id)!,
                state,
                layer: clone,
                source: action,
            })
            cost = Math.max(1, cost + r)
        })
    }
    const discounted = attacker.actionApCost(cost, state)
    if (attacker.ap < discounted) return { ok: false, reason: 'AP不足' }
    if (action.chanCost && attacker.chan < action.chanCost) return { ok: false, reason: '缠劲不足' }
    const range = getActionRange(getRuntimeAction(action.id, attacker, state) ?? action, attacker.getEffectiveRange(), attacker)
    const dist = state.position.distance(attacker.id, state.characters.find((c) => c.id !== attacker.id)!.id)
    if (dist < range[0] || dist > range[1]) return { ok: false, reason: '距离不合适' }
    if (action.requiredTags.length > 0) {
        const weaponTags = attacker.getWeaponTags()
        const hasTag = action.requiredTags.some((tag) => weaponTags.includes(tag))
        if (!hasTag) return { ok: false, reason: `需要 ${action.requiredTags.join('/')} 标签` }
    }
    if (action.canUse && !action.canUse(attacker, state)) return { ok: false, reason: '条件不满足' }
    return { ok: true }
}

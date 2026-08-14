import type { ActionDefinition } from '../entities/action'
import type { Character } from '../entities/character'
import type { BattleState } from '../combat/types'
import { getWeapon } from '../../data/weapons/weapons'
import { getActionRange, getRuntimeAction } from '../../data/actions'
import { BattleEngine } from '../combat/engine'

/** 检查招式是否满足释放条件 */
export function canExecuteAction(
    action: ActionDefinition,
    attacker: Character,
    state: BattleState,
    _engine?: BattleEngine,
): { ok: boolean; reason?: string } {
    // 验证用基础成本；onActionCost 折扣只在 #executeAction 扣费时应用一次。
    // 此处不再重复调用 onActionCost——避免带副作用的钩子（如分心错手的"只减第二招"标记）被验证/扣费两次调用。
    // 安全：onActionCost 均为负折扣，扣费成本 ≤ 验证成本，AP 够验证则扣费必成功。
    // 0 成本招式（御物召唤等）天然免费：calcActionCostAfterSpeed 对 0 成本返回 0，不校验 AP。
    const cost = attacker.actionApCost(action.apCost)
    if (attacker.ap < cost) return { ok: false, reason: 'AP不足' }
    if (action.chanCost && attacker.chan < action.chanCost) return { ok: false, reason: '缠劲不足' }
    const weapon = attacker.weaponDef ?? getWeapon(attacker.build.weapon)
    const range = getActionRange(getRuntimeAction(action.id, attacker, state) ?? action, weapon.range, attacker)
    const dist = state.position.distance(attacker.id, state.characters.find((c) => c.id !== attacker.id)!.id)
    if (dist < range[0] || dist > range[1]) return { ok: false, reason: '距离不合适' }
    if (action.requiredTags.length > 0) {
        const hasTag = action.requiredTags.some((tag) => weapon.tags.includes(tag))
        if (!hasTag) return { ok: false, reason: `需要 ${action.requiredTags.join('/')} 标签` }
    }
    if (action.canUse && !action.canUse(attacker, state)) return { ok: false, reason: '条件不满足' }
    return { ok: true }
}

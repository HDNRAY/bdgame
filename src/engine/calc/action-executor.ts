import type { ActionDefinition } from '../entities/action'
import type { Character } from '../entities/character'
import type { BattleState } from '../combat/types'
import { getWeapon } from '../data/weapons/weapons'
import { getBuff } from '../data/buffs'

/** 检查招式是否满足释放条件 */
export function canExecuteAction(
    action: ActionDefinition,
    attacker: Character,
    state: BattleState,
): { ok: boolean; reason?: string } {
    let cost = action.apCost
    for (const [key, layer] of state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2 || parts[1] !== attacker.id) continue
        const def = getBuff(parts[0])
        if (!def?.onActionCost) continue
        const target = state.characters.find((c) => c.id !== attacker.id)
        if (!target) continue
        cost = Math.max(
            1,
            cost +
                def.onActionCost({
                    final: 0,
                    raw: 0,
                    attacker,
                    target,
                    engine: null as unknown as import('../combat/engine').BattleEngine,
                    layer,
                    buffOwnerId: attacker.id,
                    action,
                }),
        )
    }
    if (attacker.ap < cost) return { ok: false, reason: 'AP不足' }
    const weapon = attacker.weaponDef ?? getWeapon(attacker.build.weapon)
    const range: [number, number] = action.getRange?.(weapon.range, attacker) ?? weapon.range
    const dist = state.position.distance(attacker.id, state.characters.find((c) => c.id !== attacker.id)!.id)
    if (dist < range[0] || dist > range[1]) return { ok: false, reason: '距离不合适' }
    if (action.requiredTags.length > 0) {
        const hasTag = action.requiredTags.some((tag) => weapon.tags.includes(tag))
        if (!hasTag) return { ok: false, reason: `需要 ${action.requiredTags.join('/')} 标签` }
    }
    if (action.canUse && !action.canUse(attacker, state)) return { ok: false, reason: '条件不满足' }
    return { ok: true }
}

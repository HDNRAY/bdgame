import type { Character } from '../entities/character'
import type { BattleState, ActionCommand } from '../combat/types'
import { getWeapon } from '../../data/weapons/weapons'
import { getBuff } from '../../data/buffs'
import { checkCondition } from '../../game/entities/action-config'
import { getConditionPreset } from '../../data/conditions'

/** 按阶段选择辅助招式 */
export function planSupportActions(
    attacker: Character,
    state: BattleState,
    apRemaining: number,
    phase: 'pre_action' | 'post_action',
    blacklist?: string[],
): ActionCommand[] {
    const cmds: ActionCommand[] = []
    const pickedIds = new Set<string>()

    // 按优先级排序
    const sorted = [...attacker.actions]
        .filter((inst) => {
            // 必须有该阶段标签
            if (!inst.def.tags.includes(phase)) return false
            if (!inst.canUse()) return false
            if (blacklist?.includes(inst.id)) return false
            // 检查武器标签兼容性
            if (inst.def.requiredTags.length > 0) {
                const weapon = attacker.weaponDef ?? getWeapon(attacker.build.weapon)
                const hasTag = inst.def.requiredTags.some((tag) => weapon.tags.includes(tag))
                if (!hasTag) return false
            }
            // 跳过纯位移辅招（dash/short_dash 无 buff/回血效果）
            if (inst.def.effects?.every((e) => e.type === 'dash' || e.type === 'short_dash' || e.type === 'knockback'))
                return false
            return true
        })
        .sort((a, b) => {
            const pa = priority(a.def.tags)
            const pb = priority(b.def.tags)
            return pb - pa
        })

    // 取多个，但同一招式不出现两次
    for (const inst of sorted) {
        if (pickedIds.has(inst.id)) continue
        if (apRemaining < inst.apCost) continue
        // 收招阶段跳过 def.canUse 和条件检查（条件在主招执行后才满足，引擎执行时会再验证）
        if (inst.def.canUse && phase === 'pre_action' && !inst.def.canUse(attacker, state)) continue

        if (phase === 'pre_action') {
            const config = attacker.getConfig(inst.id)
            if (config?.conditionId) {
                const cond = getConditionPreset(config.conditionId)
                if (cond && !checkCondition(cond, attacker, state)) continue
            }
        }

        // 收招阶段跳过去重（条件在主招执行后才满足，引擎执行时会再验证）
        if (phase === 'pre_action' && hasActiveBuff(attacker, state, inst.def)) continue

        cmds.push({ type: 'support', actionId: inst.id })
        pickedIds.add(inst.id)
        apRemaining -= inst.apCost
    }

    return cmds
}

/** 辅助招式优先级 */
function priority(tags: string[]): number {
    if (tags.includes('heal')) return 100
    if (tags.includes('damage') || tags.includes('buff')) return 50
    if (tags.includes('defense')) return 30
    return 10
}

/** 检查 buffer 类效果是否已激活 */
function hasActiveBuff(
    attacker: Character,
    state: BattleState,
    def: { effects?: { type: string; buffId?: string }[] },
): boolean {
    for (const eff of def.effects ?? []) {
        if (eff.type === 'stat_buff' || eff.type === 'stat_multiply') {
            for (const [k] of state.pendingBuffs) {
                if (k.startsWith(`${eff.type}::${attacker.id}`)) return true
            }
        }
        if (eff.type === 'add_buff' && eff.buffId) {
            const key = `${eff.buffId}::${attacker.id}`
            const layer = state.pendingBuffs.get(key)
            if (!layer) continue
            const buffDef = getBuff(eff.buffId)
            if (buffDef?.stacking?.type === 'additive') {
                const max = buffDef.stacking.max ?? Infinity
                if (layer.restoreValue < max) continue
            }
            return true
        }
    }
    return false
}

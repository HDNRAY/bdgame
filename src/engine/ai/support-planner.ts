import type { Character } from '../entities/character'
import type { BattleState, ActionCommand } from '../combat/types'
import { getBuff } from '../../data/buffs'
import { forEachBuffOf } from '../combat/utils'
import { calcActionChanCost } from '../combat/utils/action-cost'
import { checkCondition } from '../../game/entities/action-config'
import { resolveCondition } from '../../data/conditions'

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
    // 武器标签在一次辅助规划内不变，取一次复用
    const weaponTags = attacker.getWeaponTags()

    // 按优先级排序
    const sorted = [...attacker.actions]
        .filter((inst) => {
            // 必须有该阶段标签
            if (!inst.def.tags.includes(phase)) return false
            if (!inst.canUse()) return false
            if (blacklist?.includes(inst.id)) return false
            // 缠劲不够的辅助招（挂需 50 缠等）引擎会跳过，别占用计划 AP
            if (inst.def.chanCost && attacker.chan < calcActionChanCost(state, attacker, inst.def)) return false
            // 检查武器标签兼容性（双持时任一武器满足即可）
            if (inst.def.requiredTags.length > 0) {
                const hasTag = inst.def.requiredTags.some((tag) => weaponTags.includes(tag))
                if (!hasTag) return false
            }
            // 跳过位移类辅招：含完整 dash 位移效果（魅影步/云步的 dash+自buff）或纯位移/击退（every dash/short_dash/knockback）。
            // 位移招只由 planMove 负责，不当 buff 辅招选（否则一回合 preCmds + planMove 各用一次，重复位移）
            const hasFullDash = inst.def.effects?.some((e) => e.type === 'dash') ?? false
            const pureMove =
                inst.def.effects?.every((e) => e.type === 'dash' || e.type === 'short_dash' || e.type === 'knockback') ??
                false
            if (hasFullDash || pureMove) return false
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
        if (apRemaining < attacker.actionApCost(inst.apCost, state)) continue
        // 收招阶段跳过 def.canUse 和条件检查（条件在主招执行后才满足，引擎执行时会再验证）
        if (inst.def.canUse && phase === 'pre_action' && !inst.def.canUse(attacker, state)) continue

        if (phase === 'pre_action') {
            const cond = resolveCondition(attacker.getConfig(inst.id))
            if (cond && !checkCondition(cond, attacker, state)) continue
        }

        // 收招阶段跳过去重（条件在主招执行后才满足，引擎执行时会再验证）
        if (phase === 'pre_action' && hasActiveBuff(attacker, state, inst.def)) continue

        cmds.push({ type: 'support', actionId: inst.id })
        pickedIds.add(inst.id)
        apRemaining -= attacker.actionApCost(inst.apCost, state)
    }

    return cmds
}

/** 辅助招式优先级 */
function priority(tags: string[]): number {
    if (tags.includes('heal')) return 100
    if (tags.includes('buff')) return 50
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
        if (eff.type === 'stat_multiply') {
            let hasBuff = false
            forEachBuffOf(state.pendingBuffs, attacker.id, (_d, _l, buffId) => {
                if (buffId === eff.type) {
                    hasBuff = true
                    return false
                }
            })
            if (hasBuff) return true
        }
        if (eff.type === 'add_buff' && eff.buffId) {
            const key = `${eff.buffId}::${attacker.id}`
            const layer = state.pendingBuffs.get(key)
            if (!layer) continue
            const buffDef = getBuff(eff.buffId)
            if (buffDef?.stacking?.type === 'additive') {
                const max = buffDef.stacking.max ?? Infinity
                // additive 满层时：永久 buff 重放无收益（无刷新）→ 拦下避免浪费；
                // 有时长（duration）buff 满层重放会刷新时长 → 放行（如酒类续饮）
                if (layer.restoreValue < max || buffDef.expiry?.type !== 'permanent') continue
            }
            return true
        }
    }
    return false
}

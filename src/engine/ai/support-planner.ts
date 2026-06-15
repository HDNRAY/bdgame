import type { Character } from '../entities/character'
import type { BattleState, ActionCommand } from '../combat/types'

/** 选择辅助招式（support 标签），消耗剩余 AP */
export function planSupportActions(
    attacker: Character,
    state: BattleState,
    apRemaining: number,
    blacklist?: string[],
): ActionCommand[] {
    const cmds: ActionCommand[] = []
    let apLeft = apRemaining

    // 按优先级排序：heal > damage_buff > defense > hit_chance > 其他
    const sorted = [...attacker.actions]
        .filter((inst) => {
            if (!inst.def.tags.includes('support')) return false
            if (!inst.canUse()) return false
            if (blacklist?.includes(inst.id)) return false
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

    for (const inst of sorted) {
        if (apLeft < inst.apCost) continue
        if (inst.def.canUse && !inst.def.canUse(attacker, state)) continue

        // 去重：检查是否已有同 buff（通过 stat_buff / stat_multiply 效果判断）
        if (hasActiveBuff(attacker, state, inst.def)) continue

        cmds.push({ type: 'support', actionId: inst.id })
        apLeft -= inst.apCost
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
function hasActiveBuff(attacker: Character, state: BattleState, def: { effects?: { type: string }[] }): boolean {
    for (const eff of def.effects ?? []) {
        if (eff.type === 'stat_buff' || eff.type === 'stat_multiply') {
            for (const [k] of state.pendingBuffs) {
                if (k.startsWith(`${eff.type}::${attacker.id}`)) return true
            }
        }
    }
    return false
}

import { BattleLog } from './battle-log'

/** 格式化为时间轴事件列表 */
export function formatBattleLog(log: BattleLog): string[] {
    const all = log.getAll()
    const lines: string[] = []
    let pending: { time: number; actor: string; action: string; ap?: string } | null = null

    function t(ms: number): string {
        // 显示为 t=0.00 t=0.55 t=1.05 ...
        return `t=${(ms / 1000).toFixed(2)}`
    }

    function flushPending() {
        if (!pending) return
        lines.push(`${t(pending.time)} [${pending.actor}] ${pending.action}${pending.ap ? ` ${pending.ap}` : ''}`)
        pending = null
    }

    for (const { timelineMs, event: e } of all) {
        switch (e.type) {
            case 'battle_start':
                lines.push(`── ⚔️ ${e.actor} VS ${e.opponent} ──`)
                break

            case 'move':
                flushPending()
                lines.push(
                    `${t(timelineMs)} [${e.actor}] #移动（${e.apCost}AP） → ${e.newDistance}m [AP${e.apRemaining}]`,
                )
                break

            case 'attack_start':
                flushPending()
                pending = {
                    time: timelineMs,
                    actor: e.actor,
                    action: `#${e.actionName ?? e.weapon}（${e.apCost}AP）`,
                    ap: `[AP${e.apRemaining}]`,
                }
                break

            case 'check_hit':
                if (!e.result && pending) {
                    pending.action += ' → *未命中*'
                    flushPending()
                }
                break

            case 'dodge':
                if (pending) {
                    pending.action += ` → *${e.evader} 闪避*`
                    flushPending()
                }
                break

            case 'parry':
                if (pending) pending.action += ' → *招架'
                break

            case 'damage': {
                if (!pending) break
                const cur = pending
                if (cur.action.includes('闪避') || cur.action.includes('未命中')) {
                    flushPending()
                } else if (cur.action.includes('招架')) {
                    const suffix = e.isCrit ? ` ${e.final}伤害 暴击!*` : ` ${e.final}伤害*`
                    cur.action += suffix
                    flushPending()
                } else {
                    const suffix = e.isCrit
                        ? ` → *${e.target} ${e.final}伤害 暴击!*`
                        : ` → *${e.target} ${e.final}伤害*`
                    cur.action += suffix
                    flushPending()
                }
                break
            }

            case 'defeat':
                flushPending()
                lines.push(`🏆 ${e.loser} 败 — ${e.winner} 胜`)
                break

            case 'system':
                flushPending()
                lines.push(`  ${e.message}`)
                break
        }
    }

    flushPending()
    return lines
}

import { BattleLog } from './battle-log'

export function formatBattleLog(log: BattleLog): string[] {
    const all = log.getAll()
    const lines: string[] = []
    let lastTime = -1,
        lastActor = ''

    function t(ms: number) {
        return `t=${(ms / 1000).toFixed(2)}`
    }

    function checkNewEvent(ms: number, actor: string, ap: number) {
        if (ms !== lastTime || actor !== lastActor) {
            if (lastTime >= 0) lines.push('') // event 间空行
            lastTime = ms
            lastActor = actor
            if (ap > 0) {
                lines.push(`── Event ${t(ms)} [${actor}] AP${ap} ──`)
            } else {
                lines.push(`── Event ${t(ms)} [${actor}] ──`)
            }
        }
    }

    let pending: { time: number; actor: string; text: string; ap?: string; startAp: number } | null = null

    function flush() {
        if (!pending) return
        checkNewEvent(pending.time, pending.actor, pending.startAp)
        lines.push(`  ${pending.text}${pending.ap ? ` ${pending.ap}` : ''}`)
        pending = null
    }

    for (const { timelineMs: ms, event: e } of all) {
        switch (e.type) {
            case 'battle_start':
                lines.push(`── ⚔️ ${e.actor} VS ${e.opponent} ──\n`)
                break

            case 'move':
                flush()
                checkNewEvent(ms, e.actor, e.apRemaining + e.apCost)
                lines.push(`  #移动→${e.newDistance.toFixed(1)}m [AP${e.apRemaining}]`)
                break

            case 'attack_start':
                flush()
                pending = {
                    time: ms,
                    actor: e.actor,
                    text: `#${e.actionName ?? e.weapon}（${e.apCost}AP）`,
                    ap: `[AP${e.apRemaining}]`,
                    startAp: e.apRemaining + e.apCost,
                }
                break

            case 'check_hit':
                if (pending) {
                    pending.text += ` [命${(e.hitChance * 100).toFixed(0)}% 骰${(e.roll * 100).toFixed(0)}%]`
                    if (!e.result) {
                        pending.text += ' → *未命中*'
                        flush()
                    }
                }
                break

            case 'dodge':
                if (pending) {
                    pending.text += ` → *${e.evader} 闪避*`
                    flush()
                }
                break

            case 'parry':
                if (pending) pending.text += ' → *招架'
                break

            case 'check_crit':
                if (pending) {
                    pending.text += ` [暴${(e.critChance * 100).toFixed(0)}% 骰${(e.roll * 100).toFixed(0)}%]`
                }
                break

            case 'damage': {
                if (!pending) break
                const t = pending.text
                if (t.includes('闪避') || t.includes('未命中')) {
                    flush()
                    break
                }
                const critTag = e.isCrit ? ' [暴]' : ''
                if (t.includes('招架')) {
                    pending.text += `${critTag} ${e.final}*`
                } else {
                    pending.text += ` → *${e.target} ${e.final}${critTag}*`
                }
                flush()
                break
            }

            case 'defeat':
                flush()
                lines.push(`🏆 ${e.loser} 败 — ${e.winner} 胜\n`)
                break

            case 'system':
                flush()
                // 携带 actor 的系统消息 → 作为独立事件分组
                if (e.actor) {
                    checkNewEvent(ms, e.actor, 0)
                }
                lines.push(`  ${e.message}`)
                break
        }
    }
    flush()
    return lines
}
